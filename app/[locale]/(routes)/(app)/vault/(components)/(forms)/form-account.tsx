"use client";

import { Key, Link2 } from "lucide-react";
import { toast } from "react-hot-toast";
import useSWR, { KeyedMutator } from "swr";
import { useState, useEffect, FormEvent } from "react";

import { cn, fetcher } from "@/lib/utils";
import { TLabel } from "@/lib/types";
import { getUserId } from "@/lib/actions";
import LabelsSelector from "../labels-selector";
import { Button } from "@/components/ui/button";
import { decrypt, encryptRecord } from "@/lib/vault-crypto";
import ControlledInput from "@/components/controlled-input";
import { useKey } from "@/components/providers/provider-key";
import DialogDoubleCheck from "@/components/dialog-double-check";
import { useDoubleCheckStore } from "@/lib/stores/use-double-check-store";
import LinkedAccountPicker, { TLinkedOption } from "./linked-account-picker";

type TFormData = {
    title: string;
    username: string;
    password: string;
    remark: string;
    label: string[];
    keychainId?: string;
};

type TMode = "credentials" | "external"
const FormAccount = ({
    labels,
    id,
    mutate,
    opened,
    setOpened,
    keychainId,
}: {
    labels?: TLabel[]
    id?: string; // Required for edit mode
    mutate?: KeyedMutator<any>;
    opened: boolean;
    setOpened: (open: boolean) => void;
    keychainId?: string;
}) => {
    const isEdit = !!id;

    const { key, keyOfKeychains } = useKey()

    let insertedKeyVal: string | undefined;

    // If it's a custom keychain, checkk if there is a key in keyOfKeychains.
    if (keychainId && keyOfKeychains) {
        const keychainKey = keyOfKeychains[keychainId];
        if (keychainKey) {
            insertedKeyVal = keychainKey;
        }
    }

    // If it's a default keychain, check if there is a key.
    if (!keychainId && key && key != "") {
        insertedKeyVal = key;
    }

    const { setDoubleCheckOpen } = useDoubleCheckStore()

    const [loading, setLoading] = useState(false);
    const [searchKeys, setSearchKeys] = useState<string[]>([]);
    const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);
    const [mode, setMode] = useState<TMode>("credentials");
    const [formData, setFormData] = useState<TFormData>({
        title: "",
        username: "",
        password: "",
        remark: "",
        label: []
    });

    // Clear form whenever the dialog opens so stale data never pre-fills the inputs.
    useEffect(() => {
        if (opened && isEdit) {
            setFormData({ title: "", username: "", password: "", remark: "", label: [] });
            setSearchKeys([]);
            setLinkedAccountId(null);
            setMode("credentials");
        }
    }, [opened]);

    // EDIT mode as default value.
    let btnText = "編輯"
    let successText = "編輯成功！"
    let errorText = "編輯失敗！"

    if (!isEdit) {
        btnText = "新增"
        successText = "新增成功！"
        errorText = "新增失敗，請稍後再試！"
    }

    // Fetch existing data for edit mode.
    // dedupingInterval: 0 + revalidateOnMount: true ensures we always fire a
    // fresh request when the dialog opens.
    const { data: fetched, error, isLoading } = useSWR(
        isEdit && opened ? `/api/accounts/${id}` : null,
        (url) => fetcher(url),
        { dedupingInterval: 0, revalidateOnMount: true },
    );
    const data = fetched?.data;

    // Track whether we've already populated the form for this open session.
    // This prevents SWR's synchronous cache hit (isLoading=false, stale data)
    // from filling the form before the fresh response arrives.
    const [dataReady, setDataReady] = useState(false);

    useEffect(() => {
        // Reset the ready flag every time the dialog opens
        if (opened && isEdit) {
            setDataReady(false);
        }
    }, [opened]);

    // Populate form only when we have fresh data from the network.
    // Decryption is async (WebCrypto), so we resolve all fields then set state.
    useEffect(() => {
        let cancelled = false
        const run = async () => {
            if (data && isEdit && insertedKeyVal && !isLoading) {
                setSearchKeys(data.label || []);
                const linked = data.linkedAccountId || null;
                setLinkedAccountId(linked);
                setMode(linked ? "external" : "credentials");
                const [title, username, password, remark] = await Promise.all([
                    decrypt(data.title, insertedKeyVal),
                    decrypt(data.username, insertedKeyVal),
                    decrypt(data.password, insertedKeyVal),
                    decrypt(data.remark, insertedKeyVal),
                ]);
                if (cancelled) return;
                setFormData({ title, username, password, remark, label: data.label || [] });
                setDataReady(true);
            }
        };
        run();
        return () => { cancelled = true };
    }, [data, isLoading, id]);

    // Handle form input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // Pick / unpick a linked source account
    const handlePickLinked = (opt: TLinkedOption | null) => {
        if (opt) {
            setLinkedAccountId(opt._id);
            // Clear local credentials — linked accounts reference the source only.
            setFormData(prev => ({
                ...prev,
                username: "",
                password: "",
            }));
        } else {
            setLinkedAccountId(null);
        }
    };

    // Switch between credentials / external tabs
    const handleSwitchMode = (next: TMode) => {
        if (next === mode) return
        setMode(next)
        if (next === "credentials") {
            // Leaving external → drop linkage
            setLinkedAccountId(null)
        } else {
            // Leaving credentials → clear local credentials
            setFormData(prev => ({ ...prev, username: "", password: "" }))
        }
    }

    // For Add and edit
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        if ( loading ) {
            return;
        }
        
        setLoading(true);
        e.preventDefault()

        const userId = await getUserId()

        if (!userId) return

        const url = isEdit ? `/api/accounts/${id}?mode=account` : `/api/accounts/`
        const method = isEdit ? "PUT" : "POST"

        const clientKey = insertedKeyVal || ""

        if (!e.target) {
            return;
        }

        const form = e.target as HTMLFormElement;
        const title = (form.elements.namedItem("title") as HTMLInputElement).value
        const remark = (form.elements.namedItem("remark") as HTMLInputElement)?.value || ""
        const isExternal = mode === "external"
        const username = isExternal
            ? ""
            : (form.elements.namedItem("username") as HTMLInputElement)?.value || ""
        const password = isExternal
            ? ""
            : (form.elements.namedItem("password") as HTMLInputElement)?.value || ""

        if (isExternal && !linkedAccountId) {
            toast.error("請選擇要連結的外部帳號。")
            setLoading(false)
            return
        }
        if (!isExternal && !username) {
            toast.error("帳號為必填。")
            setLoading(false)
            return
        }

        const obj: any = {
            title,
            username,
            password,
            remark,
            label: searchKeys,
            userId,
            linkedAccountId: isExternal ? linkedAccountId : null,
        }
        if ( keychainId ) {
            obj.keychainId = keychainId
        }
        const encryptedObj = await encryptRecord(obj, clientKey)

        try {
            const req = await fetch(url, {
                method,
                body: JSON.stringify(encryptedObj)
            })

            const res = await req.json();


            if (res.type == "error") {
                toast.error(errorText)
            } else if (res.status === false) {
                toast.error(res.message || errorText)
            } else {               
                toast.success(successText)
                setOpened(false)
                mutate && mutate()
            }
        } catch (err) {
            console.log(err)
            toast.error(errorText)
        }

        setLoading(false);
    }

    // Handle delete (only for edit mode)
    const handleDelete = async () => {
        try {
            await fetch(
                `/api/accounts/${id}`,
                {
                    method: "DELETE"
                }
            );

            mutate && mutate()
            setOpened(false);
        } catch (err) {
            console.error(err);
        }
    };

    const tabs: { id: TMode; label: string; icon: React.ReactNode }[] = [
        { id: "credentials", label: "帳密登入", icon: <Key size={14} /> },
        { id: "external", label: "外部登入", icon: <Link2 size={14} /> },
    ]

    return (
        <>
            {/* Lables (keys) selector, for filtering */}
            <div className="pt-2">
                {labels && (
                    <LabelsSelector
                        labels={labels}
                        value={searchKeys}
                        setValue={setSearchKeys}
                    />
                )}
            </div>
            {(isEdit && opened && !dataReady) ? (
                "Loading..."
            ) : (
                <form onSubmit={handleSubmit} className="text-left flex flex-col gap-3">
                    {/* Tab switcher */}
                    <div className="flex gap-1 p-1 bg-muted rounded-md">
                        {tabs.map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => handleSwitchMode(t.id)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-1.5 rounded transition-colors",
                                    mode === t.id
                                        ? "bg-background shadow-sm font-medium"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {t.icon}
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {mode === "credentials" ? (
                        <>
                            <ControlledInput
                                id="title"
                                type="text"
                                label="項目"
                                value={formData.title}
                                onChange={handleChange}
                            />
                            <ControlledInput
                                id="username"
                                type="text"
                                label="帳號"
                                value={formData.username}
                                onChange={handleChange}
                            />
                            <ControlledInput
                                id="password"
                                type="text"
                                label="密碼"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </>
                    ) : (
                        <>
                            <ControlledInput
                                id="title"
                                type="text"
                                label="項目"
                                value={formData.title}
                                onChange={handleChange}
                            />
                            <LinkedAccountPicker
                                currentKeychainId={keychainId}
                                excludeId={id}
                                value={linkedAccountId}
                                onPick={handlePickLinked}
                            />
                        </>
                    )}

                    <ControlledInput
                        id="remark"
                        type="textarea"
                        label="備註"
                        value={formData.remark}
                        onChange={handleChange}
                    />

                    <div className=" flex justify-end gap-3">
                        {isEdit && (
                            <Button
                                type="button"
                                variant="outline"
                                className="mt-4"
                                onClick={() => setDoubleCheckOpen("account-delete", true)}
                                disabled={loading}
                            >
                                刪除
                            </Button>
                        )}
                        <Button 
                            type="submit" 
                            disabled={loading}
                            className="mt-4"
                        >
                            {btnText}
                        </Button>
                    </div>
                </form>
            )}
            {error && (
                <p className="text-red-700">
                    資料獲取錯誤
                </p>
            )}
            <DialogDoubleCheck
                id="account-delete"
                title="確定要刪除這筆資料嗎？"
                doFunction={handleDelete}
                server={true}
                disabled={loading}
            />
        </>
    );
};

export default FormAccount;