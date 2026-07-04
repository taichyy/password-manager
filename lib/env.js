// Central env access. Throws immediately if a required secret is missing,
// instead of silently falling back to "" (which would make JWT signing /
// verification and PII encryption trivially forgeable / broken).
//
// Pure process.env reads only — safe to import from the edge middleware
// (proxy.ts), server components, and Node route handlers alike.

export const requireEnv = (name) => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
};
