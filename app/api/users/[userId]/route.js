import { verify, sign } from "jsonwebtoken";
import { cookies } from "next/headers";

import connect from "@/lib/db"
import User from "@/models/User"
import { Response, MAX_AGE } from "@/lib/utils"
import { requireEnv } from "@/lib/env"
import { getUserId, apiProtect } from "@/lib/actions"
import { encryptPII, decryptPII } from "@/lib/crypto-server"

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
    const { userId } = params

    const loginedUserId = await getUserId()

    if (loginedUserId !== userId) {
        setStatus(403)
        setResponse({
            status: false,
            type: "user",
            message: "You are not authorized to access this user.",
        })
    } else {
        try {
            await connect()
            const user = await User.findById(userId)

            if (!user) {
                setStatus(404)
                setResponse({
                    status: false,
                    type: "user",
                    message: "User not found.",
                })
            } else {
                // Project only safe display fields. Never expose the password
                // hash, salt, usernameHash, or raw encrypted PII blobs.
                setStatus(200)
                setResponse({
                    status: true,
                    type: "success",
                    message: "User found.",
                    data: {
                        _id: user._id,
                        username: decryptPII(user.usernameEncrypted),
                        email: user.email ? decryptPII(user.email) : "",
                        role: user.role,
                        provider: user.provider,
                        createdAt: user.createdAt,
                    },
                })
            }
        } catch (err) {
            console.error("Error fetching User record:", err);

            setStatus(500)
            setResponse({
                status: false,
                type: "error",
                message: "User fetch failed.",
            })
        }
    }

    return getResponse()
}

export const PATCH = async (request, props) => {
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
    const { userId } = params

    const loginedUserId = await getUserId()

    if (loginedUserId !== userId) {
        setStatus(403)
        setResponse({
            status: false,
            type: "user",
            message: "You are not authorized to access this user.",
        })
        return getResponse();
    }

    const body = await request.json()

    // Construct a dynamic update object
    const updateData = {};
    const fields = ["keyGenerated"];
    fields.forEach((field) => {
        if (body[field] !== undefined) {
            updateData[field] = body[field];
        }
    });

    // Handle email update
    if (body.email !== undefined) {
        const jwtSecret = requireEnv("JWT_SECRET");

        if (typeof body.email !== "string") {
            setStatus(400);
            setResponse({ status: false, type: "validation", message: "Invalid email format." });
            return getResponse();
        }

        const newEmail = body.email.trim().toLowerCase();

        // Same format rule as registration; empty string clears the email.
        if (newEmail !== "" && !EMAIL_RE.test(newEmail)) {
            setStatus(400);
            setResponse({ status: false, type: "validation", message: "Invalid email format." });
            return getResponse();
        }

        // Encrypt and store new email (authenticated AES-GCM).
        updateData.email = encryptPII(newEmail);

        // Fetch current user data to rebuild JWT payload
        await connect();
        const user = await User.findById(userId);
        if (!user) {
            setStatus(404);
            setResponse({ status: false, message: "User not found." });
            return getResponse();
        }

        const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value;
        if (!token) {
            setStatus(401);
            setResponse({ status: false, message: "Not logged in." });
            return getResponse();
        }

        const decoded = verify(token, jwtSecret);

        // Fetch
        try {
            await User.findByIdAndUpdate(userId, updateData);

            // Re-issue JWT with updated email
            const newToken = sign(
                {
                    userId: decoded.userId,
                    username: decoded.username,
                    email: newEmail,
                    role: decoded.role,
                },
                jwtSecret,
                { expiresIn: MAX_AGE }
            );

            (await cookies()).set("token", newToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: MAX_AGE,
            });

            setStatus(200);
            setResponse({
                status: true,
                type: "email_updated",
                message: "Email updated successfully.",
            });
        } catch (err) {
            console.error("Error updating email:", err);
            setStatus(500);
            setResponse({ status: false, message: "Email update failed." });
        }

        return getResponse();
    }

    // Fetch
    try {
        // From utils/db.js
        await connect()
        await User.findByIdAndUpdate(userId, updateData)

        setStatus(200)
        setResponse({
            status: true,
            type: "success",
            message: "User has been updated.",
        })
    } catch (err) {
        console.error("Error updating User record:", err);

        setStatus(500)
        setResponse({
            status: false,
            type: "error",
            message: "User update failed.",
        })
    }

    return getResponse();
}