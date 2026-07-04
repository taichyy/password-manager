import createMiddleware from "next-intl/middleware";
import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { routing } from "@/i18n/routing";
import { requireEnv } from "@/lib/env";

const handleI18nRouting = createMiddleware(routing);
const jwtSecret = new TextEncoder().encode(requireEnv("JWT_SECRET"));

export default async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const pathSegments = pathname.split("/");
    const locale = routing.locales.includes(pathSegments[1] as "zh-TW" | "en")
        ? pathSegments[1] as "zh-TW" | "en"
        : routing.defaultLocale;
    const localizedPathname = pathSegments[1] === locale
        ? `/${pathSegments.slice(2).join("/")}`
        : pathname;
    const token = request.cookies.get("token")?.value;

    if (localizedPathname === "/vault") {
        if (!token || !(await hasValidToken(token))) {
            return redirectTo(request, locale, "/login");
        }
    }

    if (localizedPathname === "/login" && token && await hasValidToken(token)) {
        return redirectTo(request, locale, "/vault");
    }

    return handleI18nRouting(request);
}

async function hasValidToken(token: string) {
    try {
        await jwtVerify(token, jwtSecret);
        return true;
    } catch {
        return false;
    }
}

function redirectTo(request: NextRequest, locale: "zh-TW" | "en", pathname: string) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
}

export const config = {
    matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
