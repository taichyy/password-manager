"use client"

import { Link2, X, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { poster } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { decrypt } from "@/lib/vault-crypto"
import { useKey } from "@/components/providers/provider-key"

export type TLinkedOption = {
    _id: string
    title: string
    username: string
    password: string
    keychainId: string | null
    keychainLabel: string
}

type Props = {
    currentKeychainId?: string
    excludeId?: string
    value: string | null
    onPick: (opt: TLinkedOption | null) => void
    defaultLabel?: string
}

const LinkedAccountPicker = ({
    currentKeychainId,
    excludeId,
    value,
    onPick,
    defaultLabel,
}: Props) => {
    const { key: defaultKey, keyOfKeychains } = useKey()

    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [options, setOptions] = useState<TLinkedOption[]>([])
    const [loading, setLoading] = useState(false)
    const wrapRef = useRef<HTMLDivElement>(null)

    const selected = useMemo(
        () => options.find(o => o._id === value) || null,
        [options, value]
    )

    // Close on outside click
    useEffect(() => {
        if (!open) return
        const onClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", onClick)
        return () => document.removeEventListener("mousedown", onClick)
    }, [open])

    // Always load options when dialog opens and value exists (edit mode)
    useEffect(() => {
        if (open && value && !loading) {
            loadOptions()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, value])

    const loadOptions = async () => {
        if (loading) return
        setLoading(true)
        try {
            // Sources: current keychain + default keychain (if different from current)
            const targets: { keychainId: string | null, label: string, decryptKey: string }[] = []

            if (currentKeychainId) {
                const k = keyOfKeychains?.[currentKeychainId]
                if (k) targets.push({ keychainId: currentKeychainId, label: "本鑰匙圈", decryptKey: k })
            } else if (defaultKey) {
                targets.push({ keychainId: null, label: "預設鑰匙圈", decryptKey: defaultKey })
            }

            // Add default keychain as secondary source when editing custom keychain
            if (currentKeychainId && defaultKey) {
                targets.push({ keychainId: null, label: "預設鑰匙圈", decryptKey: defaultKey })
            }

            const collected: TLinkedOption[] = []
            for (const t of targets) {
                const params = { method: "get" }
                const body: any = { labels: [] }
                if (t.keychainId) body.keychainId = t.keychainId

                const res = await poster("/api/accounts", params, body)
                const list = res?.data || []

                for (const item of list) {
                    if (item.type === "validation") continue
                    if (excludeId && item._id === excludeId) continue
                    try {
                        collected.push({
                            _id: item._id,
                            title: await decrypt(item.title, t.decryptKey),
                            username: await decrypt(item.username, t.decryptKey),
                            password: await decrypt(item.password, t.decryptKey),
                            keychainId: t.keychainId,
                            keychainLabel: t.label,
                        })
                    } catch {
                        // skip un-decryptable
                    }
                }
            }

            setOptions(collected)
        } catch (err) {
            console.error("Load linked options failed:", err)
        } finally {
            setLoading(false)
        }
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return options
        return options.filter(
            o =>
                o.title.toLowerCase().includes(q) ||
                o.username.toLowerCase().includes(q) ||
                o.keychainLabel.toLowerCase().includes(q)
        )
    }, [options, query])

    const handleToggle = () => {
        const next = !open
        setOpen(next)
        if (next) loadOptions()
    }

    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm font-medium flex items-center gap-1">
                <Link2 size={14} /> 外部登入來源
            </label>
            <div ref={wrapRef} className="relative">
                {selected ? (
                    <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/40">
                        <Link2 size={16} className="text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{selected.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                                {selected.keychainLabel} · {selected.username}
                            </div>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onPick(null)}
                            className="h-7 w-7 p-0"
                            aria-label="移除連結"
                        >
                            <X size={14} />
                        </Button>
                    </div>
                ) : value && !open ? (
                    <button
                        type="button"
                        onClick={handleToggle}
                        className="w-full text-left border rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40"
                    >
                        {defaultLabel || "已連結（點擊以檢視/更換）"}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleToggle}
                        className="w-full text-left border rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40"
                    >
                        選擇外部登入的來源帳號…
                    </button>
                )}

                {open && (
                    <div className="absolute z-50 left-0 right-0 mt-1 border rounded-md bg-popover shadow-lg max-h-72 overflow-hidden flex flex-col">
                        <div className="flex items-center gap-2 border-b px-2 py-1.5">
                            <Search size={14} className="text-muted-foreground" />
                            <Input
                                autoFocus
                                placeholder="搜尋標題、帳號、鑰匙圈…"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                className="border-0 focus-visible:ring-0 shadow-none h-7 px-0"
                            />
                        </div>
                        <div className="overflow-y-auto">
                            {loading && (
                                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                    載入中…
                                </div>
                            )}
                            {!loading && filtered.length === 0 && (
                                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                    {options.length === 0
                                        ? "沒有可連結的帳號（請先解鎖鑰匙圈）"
                                        : "找不到符合的帳號"}
                                </div>
                            )}
                            {!loading && filtered.map(opt => (
                                <button
                                    key={opt._id}
                                    type="button"
                                    onClick={() => {
                                        onPick(opt)
                                        setOpen(false)
                                        setQuery("")
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 border-b last:border-b-0"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm truncate">{opt.title || "(未命名)"}</div>
                                        <div className="text-xs text-muted-foreground truncate">
                                            {opt.username}
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-[10px]">
                                        {opt.keychainLabel}
                                    </Badge>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            {selected && (
                <p className="text-xs text-muted-foreground">
                    此紀錄不儲存自己的帳號密碼，改為透過來源帳號外部登入。
                </p>
            )}
        </div>
    )
}

export default LinkedAccountPicker
