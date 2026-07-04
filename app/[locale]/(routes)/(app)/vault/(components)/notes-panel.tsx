"use client"

import axios from "axios"
import useSWR from "swr"
import toast from "react-hot-toast"
import { useEffect, useState } from "react"
import { GripVertical, Pencil, Plus, StickyNote, Trash2 } from "lucide-react"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { poster } from "@/lib/utils"
import { TNote } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { encrypt, decrypt } from "@/lib/vault-crypto"
import { Separator } from "@/components/ui/separator"
import { useKey } from "@/components/providers/provider-key"
import DialogDoubleCheck from "@/components/dialog-double-check"
import { useDoubleCheckStore } from "@/lib/stores/use-double-check-store"

type TAPINotes = {
    status: boolean
    message: string
    type?: string
    data: TNote[]
}

type NoteCardProps = {
    note: TNote
    onEdit: (note: TNote) => void
    onDelete: (id: string) => void
    // Drag handlers
    onDragStart: (id: string) => void
    onDragOver: (id: string) => void
    onDragEnd: () => void
    isDragging: boolean
    isDragOver: boolean
}

const NoteCard = ({
    note,
    onEdit,
    onDelete,
    onDragStart,
    onDragOver,
    onDragEnd,
    isDragging,
    isDragOver,
}: NoteCardProps) => {
    return (
        <Card
            draggable
            onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move"
                onDragStart(note._id!)
            }}
            onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                onDragOver(note._id!)
            }}
            onDragEnd={onDragEnd}
            onDrop={(e) => {
                e.preventDefault()
                onDragEnd()
            }}
            className={`p-3 bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-900 transition-all
                ${isDragging ? "opacity-40" : "opacity-100"}
                ${isDragOver ? "ring-2 ring-yellow-400" : ""}
            `}
        >
            <div className="flex items-start gap-2">
                <GripVertical
                    className="h-4 w-4 mt-1 text-yellow-700 dark:text-yellow-300 shrink-0 cursor-grab active:cursor-grabbing"
                />
                <div className="flex-1 min-w-0">
                    {note.title && (
                        <h5 className="font-semibold text-sm break-words whitespace-pre-wrap">
                            {note.title}
                        </h5>
                    )}
                    {note.context && (
                        <p className="text-sm text-gray-700 dark:text-gray-200 break-words whitespace-pre-wrap mt-1">
                            {note.context}
                        </p>
                    )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={() => onEdit(note)}
                        className="text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100"
                        aria-label="Edit note"
                    >
                        <Pencil className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(note._id!)}
                        className="text-red-500 hover:text-red-700"
                        aria-label="Delete note"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </Card>
    )
}

type NoteFormProps = {
    initial?: TNote | null
    onSubmit: (data: { title: string; context: string }) => Promise<void>
    onCancel: () => void
}

const NoteForm = ({ initial, onSubmit, onCancel }: NoteFormProps) => {
    const [title, setTitle] = useState(initial?.title || "")
    const [context, setContext] = useState(initial?.context || "")
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim() && !context.trim()) {
            toast.error("便利貼不能為空")
            return
        }
        setSubmitting(true)
        try {
            await onSubmit({ title, context })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-900 rounded-md">
            <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="標題（選填）"
                className="bg-white dark:bg-gray-900"
            />
            <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="內容……"
                rows={3}
                className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                    取消
                </Button>
                <Button type="submit" size="sm" disabled={submitting}>
                    {initial ? "儲存" : "新增"}
                </Button>
            </div>
        </form>
    )
}

const NotesPanel = () => {
    const { key } = useKey()
    const { setDoubleCheckOpen } = useDoubleCheckStore()

    const hasKey = !!key

    const { data: fetched, mutate, isLoading } = useSWR<TAPINotes>(
        hasKey ? ["/api/notes", { method: "get" }, {}] : null,
        ([url, params, body]) => poster(url as string, params, body),
        { dedupingInterval: 30000, revalidateOnFocus: false }
    )

    // Local ordered copy so drag operations are immediate. Decryption is async
    // (WebCrypto), so we decrypt in an effect and store the result.
    const [items, setItems] = useState<TNote[]>([])
    useEffect(() => {
        let cancelled = false
        const run = async () => {
            if (!fetched?.data || !key) {
                if (!cancelled) setItems([])
                return
            }
            const decrypted = await Promise.all(
                fetched.data.map(async (n) => ({
                    _id: n._id,
                    order: n.order,
                    title: await decrypt(n.title || "", key),
                    context: await decrypt(n.context || "", key),
                }))
            )
            if (!cancelled) setItems(decrypted)
        }
        run()
        return () => { cancelled = true }
    }, [fetched, key])

    const [adding, setAdding] = useState(false)
    const [editing, setEditing] = useState<TNote | null>(null)
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

    // Drag-and-drop state
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [dragOverId, setDragOverId] = useState<string | null>(null)

    const handleDragStart = (id: string) => setDraggingId(id)
    const handleDragOver = (id: string) => {
        if (!draggingId || draggingId === id) return
        setDragOverId(id)
        setItems((prev) => {
            const from = prev.findIndex((i) => i._id === draggingId)
            const to = prev.findIndex((i) => i._id === id)
            if (from === -1 || to === -1) return prev
            const next = [...prev]
            const [moved] = next.splice(from, 1)
            next.splice(to, 0, moved)
            return next
        })
    }
    const handleDragEnd = async () => {
        const wasDragging = draggingId
        setDraggingId(null)
        setDragOverId(null)
        if (!wasDragging) return

        // Capture the new order of IDs from the current local state
        const newOrder = items.map((i) => i._id)

        // Persist order
        try {
            await axios.put("/api/notes?method=reorder", {
                ids: newOrder,
            })
            // Re-sort the encrypted SWR cache to match the new order,
            // so the decryptedNotes memo stays in sync without a network re-fetch.
            mutate(
                (cur) => {
                    if (!cur?.data) return cur
                    const sorted = newOrder
                        .map((id) => cur.data.find((n) => n._id === id))
                        .filter(Boolean) as typeof cur.data
                    return { ...cur, data: sorted }
                },
                { revalidate: false }
            )
        } catch (err) {
            console.error("Reorder failed:", err)
            toast.error("重新排序失敗")
            mutate()
        }
    }

    const handleCreate = async ({ title, context }: { title: string; context: string }) => {
        if (!key) {
            toast.error("請先輸入金鑰")
            return
        }
        try {
            await axios.post("/api/notes", {
                title: await encrypt(title, key),
                context: await encrypt(context, key),
            })
            toast.success("新增成功")
            setAdding(false)
            mutate()
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "新增失敗")
        }
    }

    const handleUpdate = async ({ title, context }: { title: string; context: string }) => {
        if (!editing?._id) return
        if (!key) {
            toast.error("請先輸入金鑰")
            return
        }
        try {
            await axios.put(`/api/notes/${editing._id}`, {
                title: await encrypt(title, key),
                context: await encrypt(context, key),
            })
            toast.success("已更新")
            setEditing(null)
            mutate()
        } catch (err) {
            toast.error("更新失敗")
        }
    }

    const handleDelete = async (id: string) => {
        await axios.delete(`/api/notes/${id}`)
        mutate()
    }

    return (
        <div className="flex flex-col h-full w-full">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <StickyNote className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <h3 className="font-semibold">便利貼</h3>
                </div>
                {!adding && !editing && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAdding(true)}
                        disabled={!hasKey}
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        新增
                    </Button>
                )}
            </div>
            <Separator className="mb-3" />

            <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1">
                {!hasKey && (
                    <p className="text-sm text-gray-500 text-center py-4">
                        請先輸入金鑰以解鎖便利貼。
                    </p>
                )}

                {hasKey && adding && (
                    <NoteForm
                        onSubmit={handleCreate}
                        onCancel={() => setAdding(false)}
                    />
                )}

                {hasKey && isLoading && items.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">載入中……</p>
                )}

                {hasKey && !isLoading && items.length === 0 && !adding && (
                    <p className="text-sm text-gray-500 text-center py-4">
                        還沒有便利貼，點「新增」建立第一張。
                    </p>
                )}

                {items.map((note) =>
                    editing && editing._id === note._id ? (
                        <NoteForm
                            key={note._id}
                            initial={editing}
                            onSubmit={handleUpdate}
                            onCancel={() => setEditing(null)}
                        />
                    ) : (
                        <NoteCard
                            key={note._id}
                            note={note}
                            onEdit={(n) => setEditing(n)}
                            onDelete={(id) => {
                                setPendingDeleteId(id)
                                setDoubleCheckOpen("delete-note", true)
                            }}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            isDragging={draggingId === note._id}
                            isDragOver={dragOverId === note._id}
                        />
                    )
                )}
            </div>

            <DialogDoubleCheck
                id="delete-note"
                title="刪除便利貼"
                desc="此操作無法復原，確定要刪除這張便利貼嗎？"
                doFunction={async () => {
                    if (pendingDeleteId) {
                        await handleDelete(pendingDeleteId)
                        setPendingDeleteId(null)
                    }
                }}
            />
        </div>
    )
}

export default NotesPanel

// Floating action button + dialog. Visible only on small screens.
export const NotesMobileTrigger = () => {
    const [open, setOpen] = useState(false)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    aria-label="開啟便利貼"
                    className="md:hidden fixed bottom-20 right-5 z-30 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 rounded-full h-12 w-12 shadow-lg flex items-center justify-center"
                >
                    <StickyNote className="h-6 w-6" />
                </button>
            </DialogTrigger>
            <DialogContent className="w-[95%] max-w-md h-[85dvh] flex flex-col p-4">
                <DialogHeader>
                    <DialogTitle className="sr-only">便利貼</DialogTitle>
                </DialogHeader>
                <div className="flex-1 min-h-0">
                    <NotesPanel />
                </div>
            </DialogContent>
        </Dialog>
    )
}
