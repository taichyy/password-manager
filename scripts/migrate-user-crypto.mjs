// One-time migration for existing users:
//   1. usernameHash: plain SHA-256(username)  ->  HMAC-SHA256(username, USER_SECRET)
//   2. usernameEncrypted / email: CryptoJS AES-CBC  ->  authenticated AES-256-GCM
//   3. cleanup: drop the obsolete `emailVerified` field (email verification removed)
//
// Idempotent: re-running produces the same usernameHash and re-encrypts PII to
// fresh (but equivalent) v2 blobs. Every record is round-trip verified BEFORE
// it is written; on any verification failure that user is skipped and reported.
//
// Usage:
//   node --env-file=<env> scripts/migrate-user-crypto.mjs           # dry run
//   node --env-file=<env> scripts/migrate-user-crypto.mjs --apply   # write

import mongoose from "mongoose";

import { encryptPII, decryptPII, hashUsername } from "../lib/crypto-server.js";

const APPLY = process.argv.includes("--apply");

const main = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = mongoose.connection.db.collection("users");
    const all = await users.find({}).toArray();

    console.log(`Mode: ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}`);
    console.log(`Users found: ${all.length}\n`);

    const plans = [];
    const errors = [];
    const seenHashes = new Map();

    for (const u of all) {
        const id = String(u._id);
        const username = decryptPII(u.usernameEncrypted);
        const email = u.email ? decryptPII(u.email) : "";

        if (!username) {
            errors.push({ id, reason: "username decrypted to empty" });
            continue;
        }

        const newHash = hashUsername(username);

        // Collision guard: two users must never map to the same lookup hash.
        if (seenHashes.has(newHash)) {
            errors.push({ id, reason: `hash collision with user ${seenHashes.get(newHash)} (username="${username}")` });
            continue;
        }
        seenHashes.set(newHash, id);

        const newUsernameEnc = encryptPII(username);
        const newEmailEnc = email ? encryptPII(email) : "";

        // Verify round-trip before trusting the new blobs.
        if (decryptPII(newUsernameEnc) !== username) {
            errors.push({ id, reason: "username re-encrypt round-trip failed" });
            continue;
        }
        if (email && decryptPII(newEmailEnc) !== email) {
            errors.push({ id, reason: "email re-encrypt round-trip failed" });
            continue;
        }

        plans.push({ id, username, email, newHash, newUsernameEnc, newEmailEnc, hadEmail: !!u.email });
    }

    for (const p of plans) {
        console.log(`  ${p.id.slice(-6)} | username="${p.username}" | email="${p.email || "(none)"}" | hash=${p.newHash.slice(0, 12)}…`);
    }

    if (errors.length) {
        console.log(`\n!! ${errors.length} problem(s):`);
        for (const e of errors) console.log(`   ${e.id.slice(-6)}: ${e.reason}`);
    }

    if (APPLY && errors.length) {
        console.log("\nAborting: refusing to write while any user has an unresolved problem.");
        await mongoose.disconnect();
        process.exit(1);
    }

    if (APPLY) {
        let written = 0;
        for (const p of plans) {
            const set = {
                usernameHash: p.newHash,
                usernameEncrypted: p.newUsernameEnc,
            };
            if (p.hadEmail) set.email = p.newEmailEnc;

            await users.updateOne(
                { _id: new mongoose.Types.ObjectId(p.id) },
                { $set: set, $unset: { emailVerified: "", secondFAPassword: "" } },
            );
            written++;
        }
        console.log(`\nApplied: ${written} user(s) updated.`);
    } else {
        console.log(`\nDry run complete. ${plans.length} user(s) ready to migrate, ${errors.length} problem(s).`);
    }

    await mongoose.disconnect();
};

main().catch((e) => { console.error(e); process.exit(1); });
