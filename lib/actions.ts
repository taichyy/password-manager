"use server"

import { jwtVerify } from "jose"
import { cookies } from "next/headers"

import connect from "./db"
import User from "@/models/User"
import { requireEnv } from "./env"

export const getUserId = async (request?: any): Promise<string> => {
    const jwtSecret = requireEnv("JWT_SECRET");

    // Parse userId from token
    let token = ""

    if (request) {
        const authHeader = request.headers.get("authorization")
        token = authHeader?.split(" ")[1] || ""
    } else {
        token = (await cookies()).get("token")?.value || ""
    }

    const decoded = await jwtVerify(token || "", new TextEncoder().encode(jwtSecret))

    const userId = decoded.payload.userId

    return userId as string || ""
}

// Role is read from the DATABASE, not the JWT claim, so a role change (e.g. an
// admin demoting a user) takes effect immediately instead of only after the
// user's 14-day token expires or they re-login.
export const getUserRole = async (request?: any): Promise<"user" | "admin" | ""> => {
    try {
        const userId = await getUserId(request)
        if (!userId) return ""

        await connect()
        const user = await User.findById(userId).select("role")

        return (user?.role as "user" | "admin") || ""
    } catch {
        return ""
    }
}

export const tokenIsValid = async (request?: any): Promise<boolean> => {
    try {
        const jwtSecret = requireEnv("JWT_SECRET");

        // Already did basic check while getting userId.
        const userId = await getUserId(request)

        await connect()

        // Fetch tokenValidAfter from database, and compare with token's iat (issued at) field.
        const user = await User.findById(userId)

        // Parse userId from token
        let token = ""

        if (request) {
            const authHeader = request.headers.get("authorization")
            token = authHeader?.split(" ")[1] || ""
        } else {
            token = (await cookies()).get("token")?.value || ""
        }

        if (!token) return false

        const decoded = await jwtVerify(token || "", new TextEncoder().encode(jwtSecret))
        const tokenIat = decoded?.payload.iat && new Date(decoded?.payload.iat * 1000) || new Date()

        if (user && (!user.tokenValidAfter || user.tokenValidAfter <= tokenIat)) {
            return true
        } else {
            return false
        }
    } catch (error) {
        console.log(error)
        return false
    }
}

export const apiProtect = async () => {
    let roleList = ["admin", "user"]

    const adminOnly = () => roleList = ["admin"]

    const userOnly = () => roleList = ["user"]

    const getCheckResult = async (): Promise<boolean> => {
        const isValid = await tokenIsValid()

        if (!isValid) return false

        // Authoritative role check against the database.
        const role = await getUserRole()

        return roleList.includes(role)
    }

    return {
        adminOnly,
        userOnly,
        getCheckResult
    }
}
