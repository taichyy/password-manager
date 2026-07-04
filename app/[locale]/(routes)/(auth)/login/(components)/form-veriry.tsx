"use client"

import { Link } from "@/i18n/navigation"
import { useState } from "react"
import toast from "react-hot-toast"
import { useRouter } from "next/navigation"
import { FlaskConical } from "lucide-react"

import { deriveRawKey } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useKey } from "@/components/providers/provider-key"
import UncontrolledInput from "@/components/uncontrolled-input"

export default function FormVerify({
    mode = "login",
}: {
    mode?: "register" | "login"
}) {
    const router = useRouter()

    const { setSalt, setKey } = useKey()
    const [isLoading, setIsLoading] = useState(false)

    const formMode = mode || "login"

    const apiUrl = formMode == "register" ? "/api/users" : "/api/session"
    const successUrl = "/vault"
    const texts = formMode == "register" ? {
        href: "/login?mode=login",
        linkDesc: "已經有帳號了？",
        linkBtn: "登入",
        button: "註冊",
        apiSuccess: "註冊成功",
        apiError: "註冊失敗",
    } : {
        href: "login?mode=register",
        linkDesc: "還沒有帳號嗎？",
        linkBtn: "註冊",
        button: "登入",
        apiSuccess: "登入成功",
        apiError: "登入失敗",
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)

        const form = e.target as HTMLFormElement
        const email = form['email']?.value
        const username = form['username'].value
        const password = form['password'].value
        const confirmPassword = form['confirm-password']?.value

        // Val check
        if (formMode == "register" && password !== confirmPassword) {
            toast.error('密碼不一致')
            setIsLoading(false)
            return
        }

        if (!username || !password) {
            toast.error('請填寫所有欄位')
            setIsLoading(false)
            return
        }

        const body: any = {
            username,
            password,
        }
        if (formMode == "register") {
            body.email = email
        }

        try {
            const req = await fetch(apiUrl, {
                body: JSON.stringify(body),
                method: "POST"
            })

            const res = await req.json()
            const { status, type, data, message } = res || {}
            const { salt } = data || {}

            if (status) {
                if (formMode == "register") {
                    if (type == "user") {
                        toast.error("使用者已存在")
                    } else {
                        toast.success(texts.apiSuccess)
                        router.push(successUrl)
                    }
                } else if (formMode == "login") {
                    setSalt(salt)

                    const key = await deriveRawKey(password, salt)
                    setKey(key)

                    toast.success(texts.apiSuccess)

                    // Let the middlewares handle the redirect
                    router.refresh()
                }
            } else {
                let msg = ""
                if (type == "rate_limit") {
                    msg = "嘗試次數過多，請稍後再試"
                } else if (type == "validation") {
                    // Surface the server-side validation reason directly.
                    msg = message || (formMode == "register" ? "註冊失敗，請稍後再試" : "登入失敗")
                } else if (formMode == "register") {
                    msg = "註冊失敗，請稍後再試"
                } else {
                    // Login: a single generic message for both wrong username and
                    // wrong password, so the form can't be used to enumerate users.
                    msg = "帳號或密碼錯誤"
                }

                toast.error(msg)
            }
        } catch (error) {
            console.error(error)
            toast.error(texts.apiError)
        }

        setIsLoading(false)
    }

    return (
        <form onSubmit={handleSubmit} className="  flex flex-col justify-between w-full">
            <div className="flex flex-col gap-3">
                <div className="flex w-full flex-col gap-3 items-center">
                    <UncontrolledInput
                        label="使用者名稱"
                        remark={formMode == "register" ? "這將會是您的登入帳號" : "您的登入帳號"}
                        id="username"
                        type="text"
                    />
                    {formMode == "register" && (
                        <UncontrolledInput
                            label="電子信箱"
                            id="email"
                            type="email"
                        />
                    )}
                    <UncontrolledInput
                        label="密碼"
                        id="password"
                        type="password"
                    />
                    {formMode == "register" && (
                        <UncontrolledInput
                            label="確認密碼"
                            id="confirm-password"
                            type="password"
                            placeholder="請再次輸入密碼"
                        />
                    )}
                </div>
                <div className="flex justify-between text-sm">
                    <span className=" text-slate-500">
                        {texts.linkDesc}
                        <Link href={texts.href} className="text-primary/70 hover:underline ml-1">
                            {texts.linkBtn}
                        </Link>
                    </span>
                    {/* {formMode == "login" && (
                        <Link href="/forgot" className="text-primary/70 hover:underline">
                            忘記密碼？
                        </Link>
                    )} */}
                </div>

                {/* Demo account tip */}
                <div className="
                        group inline-flex p-[1px] rounded-2xl self-start
                        bg-gradient-to-b from-slate-200/80 to-slate-200/30
                        dark:from-white/[0.08] dark:to-white/[0.03]
                        transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                        hover:from-slate-300/70 hover:to-slate-200/40
                        dark:hover:from-white/[0.12] dark:hover:to-white/[0.05]
                    ">
                        <div className="
                            flex items-center gap-3
                            rounded-[calc(1rem-1px)]
                            bg-white/70 dark:bg-gray-900/80
                            shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
                            backdrop-blur-sm
                            px-3.5 py-3
                        ">
                            <span className="
                                flex-shrink-0 w-7 h-7 rounded-full
                                bg-slate-100 dark:bg-white/[0.06]
                                ring-1 ring-slate-200/80 dark:ring-white/[0.08]
                                flex items-center justify-center
                                transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                                group-hover:scale-105
                            ">
                                <FlaskConical size={13} strokeWidth={1.5} className="text-slate-500 dark:text-slate-400" />
                            </span>
                            <p className="text-[12.5px] leading-snug text-slate-500 dark:text-slate-400">
                                想先試試看？帳號和密碼都輸入
                                {" "}
                                <code className="
                                    font-mono font-semibold text-slate-700 dark:text-slate-200
                                    bg-slate-100 dark:bg-white/[0.08]
                                    px-1.5 py-0.5 rounded-md
                                    ring-1 ring-slate-200 dark:ring-white/[0.1]
                                    tracking-tight
                                ">test</code>
                                {" "}即可體驗測試帳號。
                            </p>
                        </div>
                    </div>
            </div>
            <div className="flex flex-col items-end my-6 md:mt-4">
                <Button type="submit" disabled={isLoading} className="text-white">
                    {isLoading ? "載入中" : texts.button}
                </Button>
            </div>
        </form>
    )
}