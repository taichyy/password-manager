import { twMerge } from "tailwind-merge"
import { NextResponse } from "next/server";
import { type ClassValue, clsx } from "clsx"

export const MAX_AGE = 60 * 60 * 24 * 14;

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export async function generateUserPrivateKey() {
    const rawKey = window.crypto.getRandomValues(new Uint8Array(32)); // 256-bit key
    const base64Key = btoa(String.fromCharCode.apply(null, Array.from(rawKey)));

    const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        rawKey,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
    );

    return {
        key: cryptoKey,      // 真正的 CryptoKey（可以用在前端加密資料）
        base64Key,           // 要顯示給使用者保存
    };
}

export const fetcher = async (url: string, queryParams?: any) => {
    // Construct the URL with query parameters
    const usp = new URLSearchParams(queryParams);
    const qs = usp.toString();
    const requestUrl = qs ? `${url}?${qs}` : url;

    const response = await fetch(requestUrl);

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
}

export const poster = async (
    url: string,
    // Query parameters as an object
    queryParams?: any,
    // Body parameters as an object
    bodyParams?: any,
    // Optional Bearer token
    token?: string
) => {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    // Add Authorization header if token is provided
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Construct the URL with query parameters
    const usp = new URLSearchParams(queryParams);
    const qs = usp.toString();
    const requestUrl = qs ? `${url}?${qs}` : url;

    // Configure fetch options
    const options: RequestInit = {
        method: 'POST',
        headers,
    };

    options.body = JSON.stringify(bodyParams || {});

    const response = await fetch(requestUrl, options);

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }

    return response.json();
};

export async function deriveRawKey(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();

    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const derivedBits = await window.crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: encoder.encode(salt),
            iterations: 310_000,
            hash: "SHA-256",
        },
        keyMaterial,
        256 // 256 bits = 32 bytes
    );

    // 轉成 base64 字串儲存
    const keyArray = new Uint8Array(derivedBits);
    return btoa(Array.from(keyArray).map(c => String.fromCharCode(c)).join(""));

}

// Closure, as response template
export const Response = () => {
    let status: number | null = null;

    let response: any = {
        status: false,
        type: null,
        message: null,
        data: null,
    }

    const setStatus = (newStatus: number | null) => status = newStatus;
    const setResponse = (newResponse: {
        status?: boolean,
        type?: string | null,
        message?: string | null,
        data?: any
    }) => response = { ...response, ...newResponse };

     const getResponse = () => {
        return NextResponse.json(response, { status: status ?? 500 });
    };

    return {
        status,
        response,
        setStatus,
        setResponse,
        getResponse,
    }
}
