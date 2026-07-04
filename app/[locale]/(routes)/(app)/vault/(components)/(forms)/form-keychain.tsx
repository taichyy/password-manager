"use client"

import toast from "react-hot-toast";
import { FormEvent, useState } from "react";
import { ClipLoader } from "react-spinners";
import { Check, Eye, EyeOffIcon } from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

import { Button } from "@/components/ui/button";
import { encryptRecord } from "@/lib/vault-crypto";
import ControlledInput from "@/components/controlled-input";
import { useKey } from "@/components/providers/provider-key";
import { deriveRawKey, generateUserPrivateKey } from "@/lib/utils";

// This is not the main component, but a subcomponent for the button, main below.
const ButtonKeyGenerator = ({
    copied,
    userKey,
    setUserKey,
}: {
    copied: boolean;
    userKey: string | null;
    setUserKey: (key: string | null) => void;
}) => {
    const [mode, setMode] = useState<"copy" | "generate">("generate");
    const [show, setShow] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);

    const Icon = show ? EyeOffIcon : Eye;

    const before = !userKey && mode == "copy"

    const generate = async () => {
        setLoading(true);
        setMode("copy");

        try {
            // Really generate the key
            const { base64Key } = await generateUserPrivateKey();
            await new Promise((resolve) => setTimeout(resolve, 1500));
            setUserKey(base64Key);
        } catch (error) {
            toast.error("產生金鑰失敗");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Animation while generating, designed by LottieFiles. */}
            <span className="hidden">This animation is downloaded from LottieFiles, designed by Raksha S.</span>
            {before && (
                <DotLottieReact
                    src="https://lottie.host/d69f7921-6e7b-4bfc-9391-b223de86e131/0S2McFCc8W.lottie"
                    loop
                    autoplay
                />
            )}
            {/* Button */}
            {!userKey && (
                <Button className="w-full" onClick={generate} disabled={loading}>
                    {loading ? (
                        <div className="flex items-center justify-center gap-2">
                            <ClipLoader size={18} color="#ffffff" />
                            <span>產生中...</span>
                        </div>
                    ) : (
                        "🔐 產生我的金鑰"
                    )}
                </Button>
            )}
            {/* Main area */}
            {userKey && (
                <div>
                    <div className="flex gap-3 flex-col-reverse xl:flex-row">
                        {/* Key */}
                        <div className="pt-10 pl-2 xl:w-3/5">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-green-700 text-sm font-medium">
                                    {">"} 這是你的私人金鑰，請立即儲存。
                                </p>
                                <Icon
                                    onClick={() => setShow(!show)}
                                    className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                />
                            </div>
                            <div className="border p-3 mb-4 rounded font-mono text-sm break-all transition-all duration-150 bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
                                {show ? userKey : userKey.replace(/./g, "*")}
                            </div>
                        </div>
                        {/* Animation after generated (looks like). */}
                        <div className="rounded-full w-1/4 flex justify-center items-center aspect-[1/1] bg-green-400/90 overflow-hidden mx-auto mt-6">
                            <Check
                                size={70}
                                strokeWidth="3"
                                data-aos="zoom-in"
                                data-aos-anchor-placement="top-center"
                                data-aos-delay={150}
                                className="text-white scale-150"
                            />
                        </div>
                    </div>
                    <p className="text-red-500 text-xs mt-2">
                        ⚠️ 金鑰會於初次使用後暫存於本地瀏覽器（localStorage），只要未清除資料或換裝置，您可於「登出頁」再次取得所有自訂鑰匙圈密鑰。請務必妥善保存，遺失將無法復原。
                    </p>
                </div>
            )}
        </>
    );
};

type TFormData = {
    name: string;
    secret: string;
};
const FormKeychain = ({
    mutate,
    setOpened,
}:{
    mutate?: () => void;
    setOpened: (opened: boolean) => void;
}) => {
    const { salt } = useKey()
    const [copied, setCopied] = useState<boolean>(false);
    const [userKey, setUserKey] = useState<string | null>(null);

    const [formData, setFormData] = useState<TFormData>({
        name: "",
        secret: "",
    });


    const inputs = [
        {
            id: "name",
            type: "text",
            value: formData.name,
            label: "鑰匙圈名稱"
        },
    ]
    
    // Handle form input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // For Add and edit
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        const url = `/api/keychains/`
        const method = "POST"

        if (!e.target) {
            return;
        }

        if (!userKey) {
            toast.error("請先產生金鑰");
            return;
        }

        if (!salt) {
            toast.error("無法取得加密鹽值，請重新登入");
            return;
        }

        const form = e.target as HTMLFormElement;
        const name = (form.elements.namedItem("name") as HTMLInputElement).value

        const derivedKey = await deriveRawKey(userKey, salt)

        if (!derivedKey) {
            toast.error("創建失敗，請重新登入，若問題持續存在，請聯繫管理員。");
            return;
        }

        // Encrypt the keychain's validation record client-side so the derived
        // key never leaves the browser. The server stores it as-is.
        const validationRecord = await encryptRecord(
            { type: "validation", title: "validation", username: "validation", password: "validation" },
            derivedKey,
        )

        try {
            const req = await fetch(url, {
                method,
                body: JSON.stringify({
                    name,
                    validationRecord,
                })
            })
            const res = await req.json().catch(() => ({}))

            if (!req.ok || res?.status === false) {
                toast.error(res?.message || "新增失敗")
                return
            }

            toast.success("新增成功")
            setOpened(false)
            mutate && mutate()
        } catch (err) {
            console.log(err)
            toast.error("新增失敗")
        }
    }

    const copyToClipboard = async (key?: string) => {
        if (!key || key.length < 1) {
            toast.error("金鑰不存在");
            return;
        }

        try {
            await navigator.clipboard.writeText(key);

            setCopied(true);
            toast.success("已複製金鑰");
        } catch (err) {
            toast.error("複製失敗");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="text-left flex flex-col gap-3">
        {inputs.map((input) => (
            <ControlledInput
                key={input.id}
                id={input.id}
                type={input.type as "text" | "email" | "password" | "textarea"}
                label={input.label}
                value={input.value}
                onChange={handleChange}
            />
        ))}
        {formData.name && (
            <ButtonKeyGenerator
                copied={copied}
                userKey={userKey}
                setUserKey={setUserKey}
            />
        )}
        <div className=" flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => {
                setCopied(false)
                setOpened(false)
            }}>
                取消
            </Button>
            {!copied && userKey ? (
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => copyToClipboard(userKey || "")}
                >
                    📋 複製金鑰
                </Button>
            ) : copied && (
                <Button type="submit">
                    新增
                </Button>
            )}
        </div>
    </form>
    );
}
 
export default FormKeychain;