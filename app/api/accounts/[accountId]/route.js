import connect from "@/lib/db"
import Account from "@/models/Account"
import { Response } from "@/lib/utils"
import { getUserId, apiProtect } from "@/lib/actions"

export const GET = async (request, props) => {
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


    const params = await props.params;
    const loginedUserId = await getUserId()

    const { accountId } = params

    // Fetch
    try {
        await connect()

        const account = await Account.findById(accountId)

        const { title, username, password, label, remark, userId, linkedAccountId, keychainId } = account

        if (userId != loginedUserId) {
            setStatus(403)
            setResponse({
                status: false,
                type: "error",
                message: "You are not authorized to access this account.",
            })
        } else {
            const data = {
                _id: account._id,
                title,
                username,
                password,
                remark,
                label,
                linkedAccountId: linkedAccountId || null,
                keychainId: keychainId || null,
            }
    
            setStatus(200)
            setResponse({
                status: true,
                type: "success",
                message: "Account fetched successfully.",
                data,
            })
        }
    } catch (err) {
        console.error("Error fetching account record by id:", err);

        setStatus(500)
        setResponse({
            status: false,
            type: "error",
            message: "Account fetch failed.",
        })
    }

    return getResponse()
}

export const PUT = async (request, props) => {
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

    const params = await props.params;
    const loginedUserId = await getUserId()
    const { accountId } = params

    // Get mode from search params
    const url = new URL(request.url)
    const mode = url.searchParams.get("mode")

    // Fetch
    try {
        let data = {}
        
        const body = await request.json()

        const { title, username, password, label, remark, linkedAccountId } = body || {}

        // From utils/db.js
        await connect()

        const findAccount = await Account.findById(accountId)

        if (!findAccount) {
            setStatus(404)
            setResponse({
                status: false,
                type: "error",
                message: "Account not found.",
            })

            return getResponse()
        }

         // If it's a regular PUT req.
        if (mode == "account") {
            data = {
                title,
                username,
                password,
                label,
                remark,
                linkedAccountId: linkedAccountId || null,
            }
        } else if (mode == "starred") {
            const currentStarred = findAccount.starred
            data = {
                starred: !(!!currentStarred),
            }
        }

        if (findAccount.type == "validation") {
            setStatus(400)
            setResponse({
                status: false,
                type: "error",
                message: "You cannot update a validation account.",
            })

            return getResponse()
        }

        // Ownership must be checked against the record's actual owner, not a
        // client-supplied field, otherwise a caller can just claim any userId.
        if (findAccount.userId != loginedUserId) {
            setStatus(403)
            setResponse({
                status: false,
                type: "error",
                message: "You are not authorized to access this account.",
            })
        } else {
            await Account.findByIdAndUpdate(accountId, data)

            // 取得最新資料
            const updated = await Account.findById(accountId)
            const { title, username, password, label, remark, userId: updatedUserId, linkedAccountId: updatedLinkedAccountId, keychainId: updatedKeychainId } = updated

            setStatus(200)
            setResponse({
                status: true,
                type: "success",
                message: "Account has been updated.",
                data: {
                    _id: updated._id,
                    title,
                    username,
                    password,
                    remark,
                    label,
                    linkedAccountId: updatedLinkedAccountId || null,
                    keychainId: updatedKeychainId || null,
                    userId: updatedUserId,
                }
            })
        }
    } catch (err) {
        console.error("Error updating account record:", err);

        setStatus(500)
        setResponse({
            status: false,
            type: "error",
            message: "Account update failed.",
        })
    }

    return getResponse()
}

export const DELETE = async (request, props) => {
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


    const params = await props.params;
    const loginedUserId = await getUserId()
    const { accountId } = params

    // Fetch
    try {
        await connect()

        const findAccount = await Account.findById(accountId)

        if (!findAccount) {
            setStatus(404)
            setResponse({
                status: false,
                type: "error",
                message: "Account not found.",
            })
            return getResponse()
        }

        if (findAccount.userId != loginedUserId) {
            setStatus(403)
            setResponse({
                status: false,
                type: "error",
                message: "You are not authorized to access this account.",
            })
            return getResponse()
        }

        await Account.findByIdAndDelete(accountId)

        setStatus(200)
        setResponse({
            status: true,
            type: "success",
            message: "Account has been deleted.",
        })
    } catch (err) {
        console.error("Error deleting account record:", err);

        setStatus(500)
        setResponse({
            status: false,
            type: "error",
            message: "Account deletion failed.",
        })
    }

    return getResponse()
}