// Client-side vault cryptography. Runs ONLY in the browser — the derived key
// never leaves the device, preserving the zero-knowledge guarantee the UI
// promises ("even we can't recover your data").
//
// New values use authenticated AES-256-GCM (WebCrypto) and are tagged with a
// "v2:" prefix. Legacy values (CryptoJS AES-CBC, passphrase mode, no auth tag)
// are still readable via a fallback, so existing vault entries keep working;
// they transparently upgrade to the authenticated format whenever re-saved.

import CryptoJS from "crypto-js"

import { TAccount, TNote } from "./types"

const V2_PREFIX = "v2:"

// The stored key is base64 of 32 raw PBKDF2 bytes (see deriveRawKey in utils).
const base64ToBytes = (b64: string): Uint8Array => {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
}

const bytesToBase64 = (bytes: Uint8Array): string => {
    let bin = ""
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
}

const importKey = async (key: string): Promise<CryptoKey> => {
    return window.crypto.subtle.importKey(
        "raw",
        base64ToBytes(key) as BufferSource,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"],
    )
}

// Authenticated encryption. Output: "v2:" + base64(iv(12) | ciphertext+tag)
export const encrypt = async (plaintext: string, key: string): Promise<string> => {
    if (!plaintext) return ""
    if (!key) throw new Error("Missing encryption key")

    const cryptoKey = await importKey(key)
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(plaintext)

    const ciphertext = new Uint8Array(
        await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded),
    )

    const combined = new Uint8Array(iv.length + ciphertext.length)
    combined.set(iv, 0)
    combined.set(ciphertext, iv.length)

    return V2_PREFIX + bytesToBase64(combined)
}

// Decrypts both the new authenticated format and legacy CryptoJS values.
// Returns "" on any failure (mirrors the previous AESDecrypt behaviour).
export const decrypt = async (ciphertext: string | null, key: string): Promise<string> => {
    if (!ciphertext || !key) return ""

    try {
        if (ciphertext.startsWith(V2_PREFIX)) {
            const combined = base64ToBytes(ciphertext.slice(V2_PREFIX.length))
            const iv = combined.subarray(0, 12)
            const data = combined.subarray(12)

            const cryptoKey = await importKey(key)
            const plain = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv as BufferSource },
                cryptoKey,
                data as BufferSource,
            )
            return new TextDecoder().decode(plain)
        }

        // Legacy: CryptoJS.AES.encrypt(plaintext, key) — passphrase mode.
        return CryptoJS.AES.decrypt(ciphertext, key).toString(CryptoJS.enc.Utf8)
    } catch (error) {
        console.error("Vault decryption error:", error)
        return ""
    }
}

export const encryptRecord = async (record: TAccount, key: string): Promise<TAccount> => {
    const { title, username, password, remark } = record

    return {
        ...record,
        title: await encrypt(title, key),
        username: await encrypt(username, key),
        password: await encrypt(password, key),
        remark: remark ? await encrypt(remark, key) : "",
    }
}

export const encryptRecordNote = async (record: TNote, key: string): Promise<TNote> => {
    const { title, context } = record

    return {
        ...record,
        title: title ? await encrypt(title, key) : "",
        context: context ? await encrypt(context, key) : "",
    }
}
