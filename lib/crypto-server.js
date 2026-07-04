// Server-only cryptography for user PII (username / email) and the username
// lookup hash. Uses Node's crypto (AES-256-GCM, HMAC-SHA256).
//
// NEVER import this from a client component — it must only run in route
// handlers / server components / scripts. It reads USER_SECRET.

import crypto from "crypto";
import CryptoJS from "crypto-js";

import { requireEnv } from "./env.js";

const PII_PREFIX = "v2:";

// 32-byte AES key deterministically derived from USER_SECRET.
const piiKey = () => crypto.createHash("sha256").update(requireEnv("USER_SECRET")).digest();

// Keyed, deterministic lookup hash for usernames. Unlike the old
// CryptoJS.SHA256(username, secret) — which silently ignored the secret and
// produced a plain, rainbow-table-reversible SHA-256 — this is a real HMAC.
export const hashUsername = (username) =>
    crypto.createHmac("sha256", requireEnv("USER_SECRET")).update(username).digest("hex");

// Authenticated encryption. Output: "v2:" + base64(iv(12) | tag(16) | ciphertext)
export const encryptPII = (plaintext) => {
    if (plaintext === undefined || plaintext === null) return "";

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", piiKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return PII_PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
};

// Decrypts both the new authenticated format and legacy CryptoJS AES-CBC
// (passphrase-mode) values, so reads keep working before/after migration.
export const decryptPII = (value) => {
    if (!value) return "";

    if (value.startsWith(PII_PREFIX)) {
        const raw = Buffer.from(value.slice(PII_PREFIX.length), "base64");
        const iv = raw.subarray(0, 12);
        const tag = raw.subarray(12, 28);
        const ciphertext = raw.subarray(28);

        const decipher = crypto.createDecipheriv("aes-256-gcm", piiKey(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    }

    // Legacy: CryptoJS.AES.encrypt(text, USER_SECRET)
    return CryptoJS.AES.decrypt(value, requireEnv("USER_SECRET")).toString(CryptoJS.enc.Utf8);
};
