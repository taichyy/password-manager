import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";
import { cookies } from "next/headers";

import connect from "@/lib/db"
import User from "@/models/User";
import { Response, MAX_AGE } from "@/lib/utils"
import { getUserId } from "@/lib/actions";
import { requireEnv } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashUsername, decryptPII } from "@/lib/crypto-server";

// A bcrypt hash of a throwaway value, used to spend roughly the same time
// comparing a password when the user doesn't exist — so response timing can't
// be used to enumerate valid usernames.
const DUMMY_HASH = "$2b$12$YnNttg856EWBrg9c2PF4DOTIySHDlVX0jlH1OlAYzeIAeTTBQJkWy";

// Login
export const POST = async (request) => {
    await connect();

    const jwtSecret = requireEnv("JWT_SECRET");

    const { setStatus, setResponse, getResponse } = Response()

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
        setStatus(400);
        setResponse({
            status: false,
            type: "credentials",
            message: "Username and password are required.",
            data: null,
        });
        return getResponse();
    }

    // Rate limit by username + client IP to slow brute forcing.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limited = await checkRateLimit(`login:${hashUsername(username)}:${ip}`, 10, 15 * 60 * 1000);
    if (limited) {
        setStatus(429);
        setResponse({
            status: false,
            type: "rate_limit",
            message: "Too many attempts. Please try again later.",
            data: null,
        });
        return getResponse();
    }

    try {
        const user = await User.findOne({ usernameHash: hashUsername(username) });

        // Always run a bcrypt comparison (real hash or dummy) so both the
        // wrong-username and wrong-password paths take a similar amount of
        // time and return an identical, generic error.
        const isMatch = await bcrypt.compare(password, user?.password || DUMMY_HASH);

        if (!user || !isMatch) {
            setStatus(401);
            setResponse({
                status: false,
                type: "credentials",
                message: "Username or password is incorrect.",
                data: null,
            });
            return getResponse();
        }

        const decryptedEmail = user.email ? decryptPII(user.email) : "";
        const decryptedUsername = decryptPII(user.usernameEncrypted);

        // Reset tokenValidAfter so the newly issued token will always pass validation
        await User.findByIdAndUpdate(user._id, { tokenValidAfter: new Date(0) });

        const token = sign(
            {
                userId: user._id,
                username: decryptedUsername,
                email: decryptedEmail,
                role: user.role,
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

        setStatus(200);
        setResponse({
            status: true,
            type: "user",
            message: "Login successful",
            // Note: the JWT is set as an httpOnly cookie above and is
            // deliberately NOT returned in the body. Only the vault salt
            // (needed client-side to derive the encryption key) is returned.
            data: {
                salt: user.salt,
            },
        })
    } catch (error) {
        console.error("[LOGIN_ERROR]", error);

        setStatus(500);
        setResponse({
            status: false,
            message: "Server error during login",
        });
    }

    return getResponse();
};

// Logout
export async function DELETE(request) {
    const cookieStore = await cookies();

    const { setStatus, setResponse, getResponse } = Response()

    // Update tokenValidAfter to invalidate existing tokens
    const token = cookieStore.get("token")?.value;
    if (token) {
        try {
            const userId = await getUserId();

            await User.findByIdAndUpdate(userId, { tokenValidAfter: new Date() });
        } catch (error) {
            console.error("[LOGOUT_ERROR]", error);
            // Even if token verification fails, we still want to clear the cookie
        }
    }   

    // Clear the token cookie
    cookieStore.set("token", "", {
        path: "/",
        httpOnly: true,
        // Expire immediately
        expires: new Date(0), 
    });

    setStatus(200);
    setResponse({
        status: true,
        message: "Logout successfully",
    })

    return getResponse();
}