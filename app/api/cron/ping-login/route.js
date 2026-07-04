import { timingSafeEqual } from "crypto";

// Vercel cron job: keeps the app warm by hitting the login endpoint every 29 days.
// Schedule is defined in vercel.json.
export const GET = async (request) => {
    // Verify the request comes from Vercel's cron scheduler. Fail closed when
    // CRON_SECRET is unset — otherwise "Bearer undefined" would authenticate.
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization") || "";
    const expected = Buffer.from(`Bearer ${cronSecret}`);
    const provided = Buffer.from(authHeader);
    const authorized =
        !!cronSecret &&
        expected.length === provided.length &&
        timingSafeEqual(expected, provided);

    if (!authorized) {
        return new Response(JSON.stringify({ status: false, message: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

    try {
        const response = await fetch(`${baseUrl}/api/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "test", password: "test" }),
        });

        const data = await response.json();

        return new Response(
            JSON.stringify({
                status: true,
                message: "Ping login completed",
                loginResponse: data,
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("[CRON_PING_LOGIN_ERROR]", error);

        return new Response(
            JSON.stringify({ status: false, message: "Cron ping failed", error: error.message }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
};
