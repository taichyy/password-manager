import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema({
    // AES 加密，可解碼
    usernameEncrypted: {
        type: String,
        required: true
    },
    // SHA256 hash 判斷唯一性
    usernameHash: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: false,
    },
    // Hashed password
    password: {
        type: String,
        required: true,
    },
    salt: {
        type: String,
        required: true,
    },
    provider: {
        type: String,
        required: true,
        enum: ["credentials", "google", "github"],
        default: "credentials",
    },
    // Third-party provider id, optional if provider as credentials.
    providerId: {
        type: String,
    },
    avatarUrl: {
        type: String,
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
    },
    tokenValidAfter: {
        type: Date,
        // Floored to whole seconds — JWT iat has second precision, so a
        // ms-precision default would invalidate the token signed right after
        // registration within the same second.
        default: () => new Date(Math.floor(Date.now() / 1000) * 1000),
    },
    createdAt: {
        type: Date,
        default: () => new Date(),
    },
    updatedAt: {
        type: Date,
        default: () => new Date(),
    },
});

// 自動更新 updatedAt
userSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});

// Indexes
// usernameHash already has unique: true (implicit index)
// Email lookups (login, verification flows)
userSchema.index({ email: 1 });
// Provider-based login lookups
userSchema.index({ provider: 1, providerId: 1 });

const User = mongoose?.models?.User || mongoose.model("User", userSchema);

export default User;