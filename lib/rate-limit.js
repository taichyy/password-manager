// Lightweight rate limiter backed by MongoDB (no extra infra/deps).
//
// Records one document per attempt in a capped-by-TTL collection and counts
// recent attempts for a key within a sliding window. Returns true when the
// caller is OVER the limit and should be rejected.

import mongoose from "mongoose";

import connect from "./db";

const attemptSchema = new mongoose.Schema({
    key: { type: String, required: true, index: true },
    createdAt: { type: Date, default: () => new Date() },
});

// TTL index: attempts auto-expire after 1 hour, keeping the collection tiny.
attemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 });

const RateAttempt =
    mongoose?.models?.RateAttempt || mongoose.model("RateAttempt", attemptSchema);

/**
 * @param {string} key        Bucket identifier (e.g. "login:<hash>:<ip>").
 * @param {number} max        Max attempts allowed within the window.
 * @param {number} windowMs   Sliding window size in milliseconds.
 * @returns {Promise<boolean>} true if the caller is over the limit.
 */
export const checkRateLimit = async (key, max, windowMs) => {
    try {
        await connect();

        const since = new Date(Date.now() - windowMs);
        const recent = await RateAttempt.countDocuments({ key, createdAt: { $gte: since } });

        if (recent >= max) return true;

        await RateAttempt.create({ key });
        return false;
    } catch (error) {
        // Fail open on limiter errors — never block legitimate auth because the
        // limiter itself failed. The auth check downstream still applies.
        console.error("[RATE_LIMIT_ERROR]", error);
        return false;
    }
};
