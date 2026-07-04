import mongoose from "mongoose"

import connect from "@/lib/db"
import Account from "@/models/Account"
import { Response } from "@/lib/utils"
import Keychain from "@/models/Keychain"
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

    // POST /api/keychains => create a new KeyChain
    // POST /api/keychains?method=get => get all keychains

    const userId = await getUserId()

    if (!userId) {
        setStatus(401)
        setResponse({
            status: false,
            type: "user",
            message: "User not found.",
        })

        return getResponse()
    }

    const url = new URL(request.url)
    const method = url.searchParams.get("method")

    const body = await request.json()

    if (method === "get") {
        // GET /api/keychains?method=get => get all keychains
        try {
            await connect()
    
            const keychains = await Keychain.find({
                userId
            });

            setStatus(200)
            setResponse({
                status: true,
                type: "success",
                message: "Keychains fetched successfully",
                data: keychains,
            })
        } catch (error) {
            console.error("Error fetching keychain records:", error);

            setStatus(500)
            setResponse({
                status: false,
                message: "Keychain record fetching error.",
            })

            return getResponse();
        }
    } else if ( !method ) {
        const session = await mongoose.startSession()

        // POST /api/keychains => create a new keychain.
        // The validation record is encrypted CLIENT-SIDE with the user's key and
        // sent already-encrypted. The server never sees the key or plaintext,
        // preserving the zero-knowledge guarantee for custom keychains.
        const { name, validationRecord } = body || {}

        if (!name || !validationRecord) {
            setStatus(400)
            setResponse({
                status: false,
                type: "keychain",
                message: "Keychain name and validation record are required.",
            })
            return getResponse()
        }

        // ----- Plan limit check (user role only)
        const role = await getUserRole()
        if (isLimited(role)) {
            await connect()
            const count = await Keychain.countDocuments({ userId })
            if (count >= USER_PLAN_LIMITS.keychains) {
                setStatus(403)
                setResponse({
                    status: false,
                    type: "limit",
                    message: `鑰匙圈數量已達方案上限（${USER_PLAN_LIMITS.keychains} 組）。`,
                })
                return getResponse()
            }
        }

        // Generate new keychain
        const data = {
            name,
            userId,
        }

        const newKeyChain = new Keychain(data)

        // Build the validation account from the client-encrypted blobs. Server
        // controls the trusted metadata (type / userId / keychainId); only the
        // opaque ciphertext fields come from the client.
        const newAccount = new Account({
            type: "validation",
            title: validationRecord.title,
            username: validationRecord.username,
            password: validationRecord.password,
            remark: validationRecord.remark || "",
            userId,
            keychainId: newKeyChain._id.toString(),
        })

        // Fetch
        try {
            session.startTransaction()

            // From utils/db.js
            await connect()
            await newKeyChain.save({ session })
            await newAccount.save({ session })

            await session.commitTransaction()
    
            setStatus(200)
            setResponse({
                status: true,
                type: "success",
                message: "Keychain has been created",
            })
        } catch (error) {
            console.error("Error creating keychain records:", error);

            setStatus(500)
            setResponse({
                status: false,
                message: "Keychain record creating error.",
            })

            return getResponse()
        } finally {
            session.endSession()
        }
    }

    return getResponse()
}