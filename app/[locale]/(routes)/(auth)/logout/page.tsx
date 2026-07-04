"use client"

import useSWR from "swr";
import { Link } from "@/i18n/navigation";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import { useState, useEffect} from "react";
import { useRouter } from "next/navigation";

import { cn, poster } from "@/lib/utils";
import LogoText from "@/components/logo-text";
import { Button } from "@/components/ui/button";
import ButtonCopy from "@/components/buttons/button-copy";
import { useKey } from "@/components/providers/provider-key";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LogoutPage = () => {
    const router = useRouter()
    const { keyOfKeychains, clearKeys } = useKey();

    const [isMounted, setIsMounted] = useState(false);
    const [showKeys, setShowKeys] = useState<boolean>(false);
    const [enableScroll, setEnableScroll] = useState<boolean>(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (showKeys) {
            timer = setTimeout(() => setEnableScroll(true), 150);
        } else {
            setEnableScroll(false);
        }
        return () => clearTimeout(timer);
    }, [showKeys]);

    // Get all key chains.
    const { data: keychainsData } = useSWR([
        "/api/keychains",
        { method: "get" },
        {}
    ], ([url, params, body]) => poster(url, params, body));
    const keychains = keychainsData?.data || [];

    const handleClick = async () => {
        try {
            await fetch("/api/session", { method: "DELETE" });

            toast.success("登出成功！")
        } catch (err) {
            console.error("Error in function in DialogDoubleCheck: " + err)
            toast.error("發生錯誤，請稍後再試！")
        } finally {
            // Wipe the derived vault key/salt from browser storage — the
            // session cookie alone being cleared would leave the decryption
            // key behind on this device.
            clearKeys()
            router.push("/")
        }
    }

    // Prevents hydration mismatch
    useEffect(() => {
        setIsMounted(true)
    }, [])
    if (!isMounted) {
        return null;
    }

    return (
        <main className="flex flex-col gap-2 justify-center items-center h-[100dvh] w-fit ml-auto mr-auto">
            <Link 
                href="/" 
                data-aos="fade-right"
                data-aos-anchor-placement="top-center"
                data-aos-delay={400}
                className="w-fit mr-auto text-slate-800"
            >
                <Button 
                    onClick={() => router.back()}
                    variant="outline" 
                    className="dark:bg-accent/80 dark:text-white"
                >
                    <ArrowLeft className="mr-1" size={20} />
                    返回
                </Button>
            </Link>
            <Card 
                className="w-full relative bg-white dark:bg-gray-900 min-w-[350px]"
                data-aos="fade-right"
                data-aos-anchor-placement="top-center"
            >
                <CardHeader>
                    <CardTitle>
                        <div className=" flex justify-between">
                            <LogoText />
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>
                        請務必確實記下您的登入密碼、鑰匙圈密鑰。 <br/>
                        如果重設密碼，將會清除所有預設鑰匙圈資料。 <br/>
                        如果忘記鑰匙圈密鑰，將無法找回該鑰匙圈資料。 <br/>
                    </p>
                    {keyOfKeychains && Object.keys(keyOfKeychains).length > 0 && (
                        <>
                            <div className={cn(
                                "my-4 transition-all duration-300",
                                showKeys ? "max-h-[150px]" : "max-h-0 overflow-hidden",
                                enableScroll && showKeys ? "overflow-y-auto" : "overflow-hidden"
                            )}>
                                <div className="space-y-2">
                                    {Object.entries(keyOfKeychains).map(([keychainId, key]) => {
                                        const keychainName = keychains.find((kc: any) => kc._id === keychainId)?.name || "(無名稱)";
                                        return (
                                            <div key={keychainId} className="flex items-center gap-2 border rounded px-2 py-1 bg-gray-50 dark:bg-gray-800">
                                                <div className=" flex justify-between w-full">
                                                    <span className="font-semibold text-xs text-primary mr-2">{keychainName}</span>
                                                    <span className="text-xs text-gray-400">{key}</span>
                                                </div>
                                                <ButtonCopy value={key} className="ml-auto" />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            {showKeys && <div className="text-xs text-red-500 mt-2">* 請務必妥善保存！</div>}
                        </>
                    )}
                    <div className="mt-4 flex justify-end items-end gap-3">
                        <Button 
                            variant="outline"
                            onClick={() => setShowKeys(!showKeys)}
                        >
                            {showKeys ? "隱藏暫存鑰匙" : "顯示暫存鑰匙"}
                        </Button>
                        <Button
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2"
                            onClick={handleClick}
                        >
                            登出
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}

export default LogoutPage;