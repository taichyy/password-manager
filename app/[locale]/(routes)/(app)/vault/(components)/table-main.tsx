"use client"

import axios from "axios"
import useSWR, { KeyedMutator } from "swr"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { FaStar, FaRegStar } from "react-icons/fa";
import { HiQuestionMarkCircle } from "react-icons/hi2"
import { ChevronsUpDown, Edit, Eye, EyeOff, FolderOutput, Import, Key, Link2, LockKeyhole, Pencil, PlusCircle } from "lucide-react"

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { getUserId } from "@/lib/actions"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import LabelsSelector from "./labels-selector"
import { poster } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { encrypt, decrypt } from "@/lib/vault-crypto"
import { useHideStore } from "@/lib/stores/use-hide"
import DialogSetKey from "./(dialogs)/dialog-set-key"
import DialogAccount from "./(dialogs)/dialog-account"
import DialogKeyChain from "./(dialogs)/dialog-keychain"
import { TAccount, TKeychain, TLabel } from "@/lib/types"
import ButtonCopy from "@/components/buttons/button-copy"
import { useKey } from "@/components/providers/provider-key"
import { ThemeModeToggle } from "@/components/theme-mode-toggle"
import DialogDoubleCheck from "@/components/dialog-double-check"
import DialogDeleteKeyChain from "./(dialogs)/dialog-delete-keychain"
import { useDoubleCheckStore } from "@/lib/stores/use-double-check-store"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type TAPIKeychain = {
    status: boolean,
    message: string,
    type?: string,
    data: TKeychain[]
}
type TAPIAccounts = {
    status: boolean,
    message: string,
    type?: string,
    data: TAccount[]
}

const Icon = ({
    hide,
    onClick,
    className,
}: {
    hide: boolean,
    onClick: () => void,
    className?: string
}) => {
    const props = {
        onClick,
        className,
    }

    return (
        hide
            ? <Eye {...props} />
            : <EyeOff {...props} />
    )
}

// This is not the main, but a sub-component, main below.
const CollapsibleArea = ({
    keychainId,
    keychainName,
    labels,
    hide,
    search,
    searchKeys,
    mutateKeyChains,
}: {
    keychainId?: string,
    keychainName?: string,
    labels: TLabel[],
    hide: boolean,
    search: string,
    searchKeys: string[],
    mutateKeyChains?: KeyedMutator<any>;
}) => {
    const { key, keyOfKeychains, setKeyOfKeychains } = useKey()
    const { setDoubleCheckOpen } = useDoubleCheckStore()

    // If the keychain is expanded
    const [open, setOpen] = useState(!keychainId)
    const [hasOpened, setHasOpened] = useState(false);
    // Derived state for key insertion
    const [keyInserted, setKeyInserted] = useState(false)
    const [insertedKeyVal, setInsertedKeyVal] = useState<string | null>(null)
    // Accounts
    const [accounts, setAccounts] = useState<TAccount[]>([])
    const [filtered, setFiltered] = useState<TAccount[]>([])
    // Display all used labels in the keychain
    const [allUsedLabels, setAllUsedLabels] = useState<string[]>([])
    // Check if the key chain is set correctly.
    const [keyCorrect, setKeyCorrect] = useState<boolean | null>(keychainId ? null : true)

    // If it's a custom keychain, check if there is a key in keyOfKeychains.
    useEffect(() => {
        const keychainKey = keyOfKeychains && keychainId && keyOfKeychains[keychainId];

        if (keychainKey) {
            setKeyInserted(true);
            setInsertedKeyVal(keychainKey);
            setOpen(true);
        }
    }, [keychainId, keyOfKeychains])

    // If it's a default keychain, check if there is a key.
    useEffect(() => {
        if (!keychainId && key && key != "") {
            setKeyInserted(true);
            setInsertedKeyVal(key);
        }
    }, [key, keychainId])

    // Effeciency issue: if the keychain is not opened for the 1st time, it won't fetch data.
    useEffect(() => {
        if (open && !hasOpened) {
            setHasOpened(true);
        }
    }, [open]);

    // Data fetching part.
    const paramsAcc = { method: "get" }
    const bodyAcc: any = { labels: searchKeys }
    if (keychainId) {
        bodyAcc.keychainId = keychainId
    }
    const { data: fetched, isLoading, mutate } = useSWR<TAPIAccounts>(
        keyInserted && hasOpened && ["/api/accounts", paramsAcc, bodyAcc],
        ([url, params, body]) => poster(url, params, body),
        { dedupingInterval: 30000, revalidateOnFocus: false },
    )
    const encryptedAccounts = fetched?.data

    useEffect(() => {
        accounts && setFiltered(accounts.filter(record =>
            (record.title.toLowerCase().includes(search.toLowerCase()) || record.username.toLowerCase().includes(search.toLowerCase()))
        ))
    }, [search])

    useEffect(() => {
        if (!encryptedAccounts || !insertedKeyVal) return;

        let cancelled = false

        const run = async () => {
            const decrypted = await Promise.all(encryptedAccounts.map(async (record) => ({
                ...record,
                title: await decrypt(record.title, insertedKeyVal),
                username: await decrypt(record.username, insertedKeyVal),
                password: await decrypt(record.password, insertedKeyVal),
                remark: record.remark ? await decrypt(record.remark, insertedKeyVal) : "",
            })))

            if (cancelled) return

            const keyIsCorrect = !!(decrypted.find(record => record.type == "validation" && record.username == "validation")) || !keychainId;
            setKeyCorrect(keyIsCorrect);

            if (keyIsCorrect) {
                const validationIndex = decrypted.findIndex(record => record.type === "validation" && record.username === "validation");
                if (validationIndex !== -1) {
                    decrypted.splice(validationIndex, 1);
                }
            }

            const usedLabels = keyIsCorrect ? Array.from(new Set(decrypted.map(record => record.label).flat())) as string[] : [];

            const finalAccounts = keyIsCorrect ? decrypted : []
            setAccounts(finalAccounts)
            setFiltered(
                search
                    ? finalAccounts.filter(record =>
                        record.title.toLowerCase().includes(search.toLowerCase()) ||
                        record.username.toLowerCase().includes(search.toLowerCase())
                    )
                    : finalAccounts
            )
            setAllUsedLabels(usedLabels)
        }

        run()
        return () => { cancelled = true }
    }, [encryptedAccounts, insertedKeyVal])

    useEffect(() => {
        mutate()
    }, [searchKeys])

    const handleStarToggle = async (id: string) => {
        const userId = await getUserId()

        if (!userId) return

        const update = async (id: string) => {
            try {
                const req = await axios({
                    method: 'put',
                    url: `/api/accounts/${id}?mode=starred`,
                    data: {
                        userId,
                    },
                })

                // Only update the local state for efficiency, and put the starred items at the top.
                setFiltered(prev => {
                    const updated = prev.map(item => {
                        if (item._id === id) {
                            return { ...item, starred: !item.starred }
                        }
                        return item
                    });

                    // Sort: starred items at the top
                    return updated.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0));
                });
            } catch (error) {
                console.error("Error toggling star:", error);
            }
        }

        update(id)
    }

    // 匯出功能
    const handleExport = () => {
        // 匯出該 keychain 下所有帳號（已解密）
        const exportData = accounts.map(({ _id, ...rest }) => rest)
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${keychainName || "default-keychain"}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    // 匯入功能（修正版，input 用 ref 控制）
    const inputRef = useRef<HTMLInputElement>(null)
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !insertedKeyVal) return
        try {
            const text = await file.text()
            const importData = JSON.parse(text)
            // 重新加密（使用已驗證的 AES-GCM）
            const encrypted = await Promise.all(importData.map(async (record: any) => ({
                ...record,
                title: await encrypt(record.title, insertedKeyVal),
                username: await encrypt(record.username, insertedKeyVal),
                password: await encrypt(record.password, insertedKeyVal),
                remark: record.remark ? await encrypt(record.remark, insertedKeyVal) : "",
                keychainId: keychainId || null,
            })))
            await axios.post("/api/accounts", encrypted)
            mutate()
            alert("匯入成功！")
        } catch (err) {
            alert("匯入失敗，檔案格式錯誤或加密金鑰不符")
            console.error(err)
        } finally {
            // 清空 input value 以便重複上傳同一檔案
            e.target.value = ""
        }
    }

    return (
        <Collapsible
            open={open}
            onOpenChange={setOpen}
            className="w-full space-y-2 mt-2"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center justify-between w-fit">
                    <Tooltip>
                        <TooltipTrigger>
                            {keychainId ? (
                                <Badge className="mr-2 mb-1" variant="outline">
                                    自訂
                                </Badge>
                            ) : (
                                <HiQuestionMarkCircle
                                    size={24}
                                    className="pb-1 cursor-pointer"
                                />
                            )}
                        </TooltipTrigger>
                        {keychainId ? (
                            <TooltipContent>
                                自訂鑰匙圈會以您生成的金鑰進行加密。
                                <br />
                                如果您遺失金鑰，包括我們，都將無法為您找回資料。
                            </TooltipContent>
                        ) : (
                            <TooltipContent>
                                預設鑰匙圈會以您的登入密碼、伺服器金鑰進行雙重加密。
                                <br />
                                如果您重設密碼，預設鑰匙圈的內容將會被清空。
                            </TooltipContent>
                        )}
                    </Tooltip>
                    <h4 className="font-semibold">
                        {keychainName || "預設鑰匙圈"}
                    </h4>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                            <ChevronsUpDown className="h-4 w-4" />
                            <span className="sr-only">Toggle</span>
                        </Button>
                    </CollapsibleTrigger>
                </div>
                <div className="flex items-center gap-2">
                    {/* 匯出/匯入按鈕 */}
                    {keyInserted && keyCorrect && (
                        <>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Import onClick={() => inputRef.current?.click()} />
                                </TooltipTrigger>
                                <TooltipContent>
                                    匯入帳號資料（JSON檔）
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger>
                                    <FolderOutput onClick={handleExport} />
                                </TooltipTrigger>
                                <TooltipContent>
                                    匯出目前鑰匙圈
                                </TooltipContent>
                            </Tooltip>
                            <input
                                ref={inputRef}
                                type="file"
                                accept="application/json"
                                style={{ display: "none" }}
                                onChange={handleImport}
                            />
                        </>
                    )}
                    {(keyInserted && keyCorrect && keychainId) && (
                        <>
                            <Tooltip>
                                <TooltipTrigger>
                                    <LockKeyhole
                                        className="cursor-pointer"
                                        onClick={() => {
                                            setDoubleCheckOpen("re-lock-keychain", true)
                                        }}
                                    />
                                </TooltipTrigger>
                                <TooltipContent>
                                    重新上鎖
                                </TooltipContent>
                            </Tooltip>
                            <DialogDoubleCheck
                                id="re-lock-keychain"
                                title="重新上鎖鑰匙圈"
                                desc="這將會清除目前鑰匙圈的內容，並且需要重新輸入金鑰才能再次存取。"
                                doFunction={() => {
                                    setOpen(false)
                                    setFiltered([])
                                    setAccounts([])
                                    setKeyInserted(false)
                                    setInsertedKeyVal(null)
                                    keychainId && setKeyOfKeychains(keychainId, null)
                                }}
                            />
                        </>
                    )}
                    {/* TODO: Finish keychain deleting. */}
                    {keychainId && (
                        <DialogDeleteKeyChain
                            keychainId={keychainId}
                            keychainName={keychainName || ""}
                            mutate={mutateKeyChains}
                        />
                    )}
                </div>
            </div>
            {keyCorrect && keyInserted ? (
                <>
                    {hasOpened && (
                        <div className="rounded-md border px-4 py-2 font-mono text-sm shadow-sm">
                            {allUsedLabels?.join("、") || "無標籤"}
                        </div>
                    )}
                    <CollapsibleContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4">
                        {!!filtered?.length && filtered.map(item => (
                            <Card key={item._id} className="mt-4 py-4 px-3 flex flex-col justify-start">
                                <div className="flex justify-between items-center pb-2">
                                    <span>
                                        {item?.starred ? (
                                            <FaStar
                                                size={20}
                                                className="cursor-pointer text-yellow-300"
                                                onClick={() => item._id && handleStarToggle(item._id)}
                                            />
                                        ) : (
                                            <FaRegStar
                                                size={20}
                                                className="cursor-pointer text-gray-400"
                                                onClick={() => item._id && handleStarToggle(item._id)}
                                            />
                                        )}
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                        {item?.linkedAccountId && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Badge variant="outline" className="text-xs gap-1">
                                                        <Link2 size={12} />
                                                        外部登入
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    此紀錄透過其他帳號外部登入
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                        {item?.label && item.label.length > 0 && item.label.map((label, index) => (
                                            <Badge key={index} variant="outline" className="text-sm text-primary bg-orange-50">
                                                {label}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-grow">
                                    <div className="pl-2 text-base">
                                        {item.title}
                                        <div className="flex justify-between flex-col flex-wrap mt-2">
                                            {item.linkedAccountId ? (
                                                (() => {
                                                    const src = accounts.find(a => a._id === item.linkedAccountId)
                                                    return (
                                                        <div className="flex items-center gap-1 flex-1 w-full text-sm text-muted-foreground">
                                                            <Link2 size={16} />
                                                            <span className="truncate">
                                                                透過「{src?.title || "其他鑰匙圈中的帳號"}」外部登入
                                                            </span>
                                                        </div>
                                                    )
                                                })()
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-1 flex-1 w-full">
                                                        <Key size={16} />
                                                        <div className=" min-w-[60px] md:min-w-[90px] lg:min-w-[120px] overflow-clip">
                                                            {!hide ? item.username : item.username.replace(/./g, "*")}
                                                        </div>
                                                        {!hide && <ButtonCopy value={item.username} className="ml-auto" />}
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-1 w-full">
                                                        <Key size={16} />
                                                        <div className=" min-w-[60px] md:min-w-[90px] lg:min-w-[120px] overflow-clip">
                                                            {!hide
                                                                ? item.password.length > 20 ? item.password.slice(0, 20) + '...' : item.password
                                                                : item.password.length > 20 ? item.password.replace(/./g, "*").slice(0, 20) + '...' : item.password.replace(/./g, "*")
                                                            }
                                                        </div>
                                                        {!hide && <ButtonCopy value={item.password} className="ml-auto" />}
                                                    </div>
                                                </>
                                            )}
                                            {/* 第二行：備註 */}
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <span className="flex items-center gap-1">
                                                        <Pencil size={16} />
                                                        {!hide
                                                            ? item.remark ? (item.remark.length > 20 ? item.remark.slice(0, 20) + '...' : item.remark) : "--"
                                                            : item.remark ? (item.remark.length > 20 ? item.remark.replace(/./g, "*").slice(0, 20) + '...' : item.remark.replace(/./g, "*")) : "******"
                                                        }
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {item.remark}
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 justify-end mt-4">
                                        {/* This is a dialog, which display only the button. */}
                                        <DialogAccount
                                            labels={labels}
                                            mutate={mutate}
                                            id={item._id}
                                            keychainId={keychainId}
                                        >
                                            <Edit size={20} className="text-slate-600 cursor-pointer" />
                                        </DialogAccount>
                                        {/* TODO: Sharing feat. */}
                                        {/* <DialogShare /> */}
                                    </div>
                                </div>
                            </Card>
                        ))}
                        <DialogAccount
                            mutate={mutate}
                            labels={labels}
                            keychainId={keychainId}
                        >
                            <Card className="mt-4 py-4 px-3 min-h-[200px] cursor-pointer flex justify-center items-center opacity-50 hover:opacity-100 transition-opacity duration-300 bg-transparent hover:bg-white/40 dark:hover:bg-gray-800/40">
                                <PlusCircle
                                    size={32}
                                    className="text-slate-700 dark:text-slate-300 cursor-pointer"
                                />
                            </Card>
                        </DialogAccount>
                    </CollapsibleContent>
                    {!isLoading && !(filtered.length) && open && (
                        <div className="flex justify-center items-center mt-20">
                            暫無紀錄，
                            點擊上方<PlusCircle className="mx-2 hidden sm:inline" />新增一筆
                        </div>
                    )}
                </>
            ) : (
                <div className="flex justify-center items-center pt-14 pb-20">
                    <DialogSetKey keychainId={keychainId} keyCorrect={keyCorrect} />
                </div>
            )}
        </Collapsible>
    )
}

const TableMain = ({
    labels,
    children,
}: {
    labels: TLabel[],
    children?: React.ReactNode
}) => {
    const router = useRouter()
    const { key, clearKeys } = useKey()

    const { hide, setHide } = useHideStore()

    const [force, setForce] = useState(false)
    const [isMounted, setIsMounted] = useState(false)
    const [search, setSearch] = useState("")
    const [searchKeys, setSearchKeys] = useState<string[]>([])

    const paramsKeychain = { method: "get" }
    const bodyKeychain = {}
    const { data: fetched, isLoading, mutate } = useSWR<TAPIKeychain>(
        ["/api/keychains", paramsKeychain, bodyKeychain],
        ([url, params, body]) => poster(url, params, body),
        { dedupingInterval: 30000, revalidateOnFocus: false },
    )
    const keychains = fetched?.data

    // If there isn't a key, logout the user by hitting DELETE.
    // Generally, this would be handled by the middleware with auto-redirect, just in case.
    const logout = async () => {
        try {
            await axios(
                {
                    method: "DELETE",
                    url: "/api/session",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            )
        } catch (error) {
            console.error("Logout error when user key is empty at vault table-main:", error);
        }

        // Wipe the derived vault key/salt from browser storage on forced logout.
        clearKeys()

        // Let the middleware handle the redirect.
        router.refresh()
    }
    useEffect(() => {
        (!key || key == "") && setForce(true)
    }, [key])

    // Prevents hydration mismatch
    useEffect(() => {
        setIsMounted(true)
    }, [])
    if (!isMounted) {
        return null;
    }

    return (
        <div>
            {/* Top tool bar */}
            <nav className="flex justify-between mb-4 flex-wrap gap-4 ">
                <div className=" flex justify-center items-center gap-2">
                    <Icon
                        hide={hide}
                        onClick={() => setHide(!hide)}
                        className="cursor-pointer"
                    />
                    {/* Use children here is kinda weird, this is mainly for keeping the children server component. */}
                    {children}
                    <DialogKeyChain mutate={mutate} />
                </div>
                <div className="flex gap-2 ml-auto">
                    <ThemeModeToggle />
                </div>
            </nav>
            {/* Filter keys */}
            <LabelsSelector
                labels={labels}
                value={searchKeys}
                setValue={setSearchKeys}
            />
            <Input
                defaultValue={search}
                onChange={(e) => {
                    setSearch(e.target.value)
                }}
                placeholder="搜尋......"
                className="h-[50px] text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            {/* Main area, under search and filtering section. */}
            {/* First one, without keychainId, means default keychain */}
            {!isLoading && (
                <main className="my-4 flex flex-col gap-4">
                    <CollapsibleArea
                        labels={labels}
                        hide={hide}
                        search={search}
                        searchKeys={searchKeys}
                    />
                    {/* All the other conditional rendering keychains */}
                    {keychains && keychains.length > 0 && keychains.map((keychain) => (
                        <CollapsibleArea
                            key={keychain._id}
                            keychainId={keychain._id}
                            keychainName={keychain.name}
                            labels={labels}
                            hide={hide}
                            search={search}
                            searchKeys={searchKeys}
                            mutateKeyChains={mutate}
                        />
                    ))}
                </main>
            )}
            <DialogDoubleCheck
                id="logout-without-key"
                title="登入逾時"
                desc="為了您的安全，請重新登入。"
                doFunction={logout}
                server={true}
                force={force}
            />
        </div>
    );
}

export default TableMain;