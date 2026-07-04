"use client";

import { createContext, ReactNode, useContext } from "react";

type KeyContextType = {
    key: string | null;
    setKey: (derivedKey: string) => void;
    salt: string | null;
    setSalt: (salt: string) => void;
    keyOfKeychains?: {
        // key -> _id of specefic custom keychain
        [key: string]: string;
    }
    setKeyOfKeychains: (key: string, keychain: string | null) => void;
    // Wipes the derived vault key + salt (called on logout / session end).
    clearKeys: () => void;
};

const KeyContext = createContext<KeyContextType | undefined>(undefined);

// The password-derived vault key lives in sessionStorage, NOT localStorage:
// it is re-derivable from the password at next login, so persisting it on
// disk after the tab closes only extends the window in which XSS or local
// device access can steal it. Custom keychain keys ("user-derive-keys") are
// random and unrecoverable if lost, so those intentionally stay in
// localStorage (documented product behaviour on the sign-out page).
const readSensitive = (name: string): string => {
    if (typeof window === "undefined") return "";

    // One-time migration: older versions kept these in localStorage.
    const legacy = localStorage.getItem(name);
    if (legacy) {
        sessionStorage.setItem(name, legacy);
        localStorage.removeItem(name);
    }

    return sessionStorage.getItem(name) || "";
};

export const ProviderKey = ({ children }: { children: ReactNode }) => {
    // This should not be user-entered key, but a derived key (encoded with salt)
    const key = readSensitive("user-derive-key");
    // Fetched at login or register
    const salt = readSensitive("user-salt");
    // Random per-keychain keys, shown once and retrievable from the sign-out page.
    const keyOfKeychains = typeof window != "undefined" ? JSON.parse(localStorage.getItem("user-derive-keys") || "[]") : [];

    const setKey = (derivedKey: string) => {
        sessionStorage.setItem("user-derive-key", derivedKey);
    }
    const setSalt = (salt: string) => {
        sessionStorage.setItem("user-salt", salt);
    }
    const setKeyOfKeychains = (key: string, keychain: string | null) => {
        const existingKeys = keyOfKeychains || {};
        const updatedKeys = { ...existingKeys, [key]: keychain };

        // Update the key of keychains in localStorage
        if (keychain === null) {
            delete updatedKeys[key];
        }

        localStorage.setItem("user-derive-keys", JSON.stringify(updatedKeys));
    };
    const clearKeys = () => {
        sessionStorage.removeItem("user-derive-key");
        sessionStorage.removeItem("user-salt");
        // Also clear any legacy localStorage copies from older versions.
        localStorage.removeItem("user-derive-key");
        localStorage.removeItem("user-salt");
    };

    return (
        <KeyContext.Provider value={{ key, setKey, salt, setSalt, keyOfKeychains, setKeyOfKeychains, clearKeys }}>
            {children}
        </KeyContext.Provider>
    );
};

export const useKey = () => {
    const context = useContext(KeyContext);
    if (!context) {
        throw new Error("useKey must be used within a ProviderKey");
    }
    return context;
};
