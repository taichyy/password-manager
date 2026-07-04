import bcrypt from "bcryptjs"
import CryptoJS from "crypto-js"
import { sign } from "jsonwebtoken";
import { cookies } from "next/headers"

import connect from "@/lib/db"
import User from "@/models/User"
import { Response, MAX_AGE } from "@/lib/utils"
import { requireEnv } from "@/lib/env"
import { checkRateLimit } from "@/lib/rate-limit"
import { hashUsername, encryptPII } from "@/lib/crypto-server"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Create a new user.
export const POST = async (request) => {
    await connect();

    const jwtSecret = requireEnv("JWT_SECRET");

    const { setStatus, setResponse, getResponse } = Response()

    const body = await request.json();
    const { username, password, email } = body;

    // ----- Input validation
    if (!username || typeof username !== "string" || username.trim().length < 2 || username.length > 64) {
        setStatus(400);
        setResponse({ status: false, type: "validation", message: "Username must be 2-64 characters." });
        return getResponse();
    }
    // Upper bound matches bcrypt's 72-byte input limit — anything longer would
    // be silently truncated, giving users a false sense of a stronger password.
    if (!password || typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
        setStatus(400);
        setResponse({ status: false, type: "validation", message: "Password must be 8-72 characters." });
        return getResponse();
    }
    if (email !== undefined && email !== "" && !EMAIL_RE.test(String(email))) {
        setStatus(400);
        setResponse({ status: false, type: "validation", message: "Invalid email format." });
        return getResponse();
    }

    // Rate limit registrations per client IP.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limited = await checkRateLimit(`register:${ip}`, 10, 60 * 60 * 1000);
    if (limited) {
        setStatus(429);
        setResponse({ status: false, type: "rate_limit", message: "Too many attempts. Please try again later." });
        return getResponse();
    }

    const usernameHash = hashUsername(username);
    const encryptedUsername = encryptPII(username);
    const encryptedEmail = email ? encryptPII(email) : "";
    const passwordHash = await bcrypt.hash(password, 12);

    const newUserSalt = CryptoJS.lib.WordArray.random(16).toString();

    try {
        const existingUser = await User.findOne({ usernameHash });

        if (existingUser) {
            setStatus(200);
            setResponse({
                status: true,
                type: "user",
                message: "User already exists",
                data: null,
            })
            return getResponse()
        }

        const newUser = new User({
            usernameEncrypted: encryptedUsername,
            usernameHash,
            password: passwordHash,
            email: encryptedEmail,
            salt: newUserSalt,
            role: "user",
        });

        const savedUser = await newUser.save();

        const token = sign(
            {
                userId: savedUser._id,
                username,
                email: email || "",
                role: savedUser.role,
            },
            jwtSecret,
            {
                expiresIn: MAX_AGE,
            }
        );

        (await cookies()).set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: MAX_AGE,
        });

        setStatus(201);
        setResponse({
            status: true,
            type: "success",
            message: "Registration successful",
        })
    } catch (error) {
        console.error("[REGISTER_ERROR]", error);

        setStatus(500);
        setResponse({
            status: false,
            message: "Registration failed, please try again.",
        })
    }

    return getResponse()
};
