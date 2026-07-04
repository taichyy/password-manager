import connect from "@/lib/db"
import Label from "@/models/Label"
import Account from "@/models/Account"
import { Response } from "@/lib/utils"
import { USER_PLAN_LIMITS, isLimited } from "@/lib/limits"
import { getUserId, getUserRole, apiProtect } from "@/lib/actions"

export const POST = async (request) => {
    // ----- General api check.
    // Auth helpers
    const { getCheckResult } = await apiProtect()
    const valid = await getCheckResult()

    // Response helpers
    const { setStatus, setResponse, getResponse } = Response()

    // Auth check
    if (!valid) {
        setStatus(403)
        setResponse({
            status: false,
            message: "Access denied.",
        })
        return getResponse();
    }

    // POST /api/accounts => create a new account
    // POST /api/accounts?method=get => get all accounts

    const userId = await getUserId()

    if (!userId) {
        setStatus(401)
        setResponse({
            status: false,
            type: "user",
            message: "User not found.",
        })

        return getResponse();
    }

    const url = new URL(request.url)
    const method = url.searchParams.get("method")

    const body = await request.json()

    if (method === "get") {
        // GET /api/accounts?method=get => get all accounts
        try {
            // Labels for filtering. Coerced to plain strings so client input
            // can't smuggle MongoDB query operators into the filter.
            const { labels, keychainId } = body || {}
            const labelFilter = Array.isArray(labels) ? labels.map(String) : []

            await connect()

            const query = { userId };

            if (labelFilter.length > 0) {
                query.label = { $in: labelFilter };
            }
            if (keychainId) {
                query.keychainId = String(keychainId);
            } else {
                // Null, isn't null, but default key chain
                query.keychainId = null; 
            }

            const accounts = await Account.find(query).sort({ starred: -1, });

            // Collect all used label key
            const allLabelKeys = Array.from(new Set(accounts.flatMap(acc => acc.label)));

            // Kind of join operation here
            const labelDocs = await Label.find({ key: { $in: allLabelKeys } });
            const labelMap = new Map(labelDocs.map(label => [label.key, label.name]));
            const accountsWithLabelNames = accounts.map(acc => ({
                ...acc.toObject(),
                label: acc.label.map(key => labelMap.get(key) || key) // fallback to key if name not found
            }));

            setStatus(200)
            setResponse({
                status: true,
                type: "success",
                message: "Account fetched successfully",
                data: accountsWithLabelNames,
            })
        } catch (error) {
            console.error("Error fetching account records:", error);

            setStatus(500)
            setResponse({
                status: false,
                message: "Account record fetching error.",
            })

            return getResponse();
        }
    } else if (!method) {
        // 支援單筆與批量新增
        // 單筆: body 為物件，批量: body 為陣列
        // Only whitelisted fields are taken from the client. Spreading the raw
        // body would let a caller set trusted fields like type ("validation"
        // bypasses plan limits and locks the record against edits) or _id.
        const pickAccountFields = (acc) => {
            const { title, username, password, remark, label, keychainId, linkedAccountId } = acc || {};
            return { title, username, password, remark, userId, label, keychainId, linkedAccountId: linkedAccountId || null };
        };

        const accounts = Array.isArray(body)
            ? body.map(pickAccountFields)
            : [pickAccountFields(body)];

        // ----- Plan limit check (user role only)
        // Group incoming accounts by keychainId (null => default keychain).
        // Validation accounts (inserted automatically on keychain creation) do not count.
        const role = await getUserRole()
        if (isLimited(role)) {
            try {
                await connect();

                const grouped = accounts.reduce((acc, cur) => {
                    if (cur.type === "validation") return acc
                    const kcId = cur.keychainId || null
                    acc.set(kcId, (acc.get(kcId) || 0) + 1)
                    return acc
                }, new Map())

                for (const [keychainId, incoming] of grouped.entries()) {
                    const existing = await Account.countDocuments({
                        userId,
                        keychainId: keychainId || null,
                        type: { $ne: "validation" },
                    })
                    if (existing + incoming > USER_PLAN_LIMITS.accountsPerKeychain) {
                        setStatus(403)
                        setResponse({
                            status: false,
                            type: "limit",
                            message: `${USER_PLAN_LIMITS.accountsPerKeychain} 組帳號已達方案上限。`,
                        })
                        return getResponse()
                    }
                }
            } catch (error) {
                console.error("Error checking account limits:", error);
                setStatus(500);
                setResponse({
                    status: false,
                    message: "Account limit check error.",
                });
                return getResponse();
            }
        }

        try {
            await connect();
            await Account.insertMany(accounts);
            setStatus(200);
            setResponse({
                status: true,
                type: "success",
                message: accounts.length > 1 ? "Accounts have been created" : "Account has been created",
            });
        } catch (error) {
            console.error("Error creating account records:", error);
            setStatus(500);
            setResponse({
                status: false,
                message: "Account record creating error.",
            });
            return getResponse();
        }
    }
    return getResponse();
}