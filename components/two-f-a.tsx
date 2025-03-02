"use client"
import { FormEvent, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "./ui/input";
import { Button } from "./ui/button";

const Edit = ({ 
    setVerified, 
    Icon,
    size,
}:{ 
    setVerified: (verift: boolean) => void, 
    Icon: any, 
    size?: number,
}) => {

    const [msg, setMsg] = useState("")

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        
        const form = e.target as HTMLFormElement;
        const password = (form.elements.namedItem("password") as HTMLInputElement).value

        if (password == process.env.NEXT_PUBLIC_2FA_PASSWORD) {
            setVerified(true)
        } else {
            setMsg("密碼錯誤！")
        }
    }

    return (
        <Dialog>
            <DialogTrigger>
                <Icon size={size || 16} />
            </DialogTrigger>
            <DialogContent className="max-w-[300px]">
                <DialogHeader>
                    <DialogTitle>輸入密碼</DialogTitle>
                    <form onSubmit={(e) => handleSubmit(e)}>
                        <Input name="password" className="mt-4" />
                        <Button type="submit" className="mt-4 w-full">
                            確定
                        </Button>
                    </form>
                </DialogHeader>
                <DialogDescription className="text-red-700">
                    {msg}
                </DialogDescription>
            </DialogContent>
        </Dialog>
    );
}

export default Edit;