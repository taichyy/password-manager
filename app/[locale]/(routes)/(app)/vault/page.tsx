import { Link } from "@/i18n/navigation";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

import connect from "@/lib/db";
import Label from "@/models/Label";
import { requireEnv } from "@/lib/env";
import LogoText from "@/components/logo-text";
import { TJWTPayload, TLabel } from "@/lib/types";
import TableMain from "./(components)/table-main";
import ButtonBackToTop from "@/components/buttons/button-back-to-top";
import { StickyHeaderWrapper } from "./(components)/sticky-header-wrapper";
import NotesPanel, { NotesMobileTrigger } from "./(components)/notes-panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import DialogAdminSettings from "./(components)/(dialogs)/dialog-admin-settings";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { LanguageToggle } from "@/components/language-toggle";

const VaultPage = async () => {
    const jwtSecret = requireEnv("JWT_SECRET");

    const token = (await cookies()).get("token")?.value
    const decoded = await jwtVerify(token || "", new TextEncoder().encode(jwtSecret))

    const jwt = decoded?.payload as TJWTPayload

    const role: "user" | "admin" = jwt.role || "user"
    const username: string = jwt.username || ""

    await connect()
    const labels: TLabel[] = JSON.parse(JSON.stringify(await Label.find({}).lean()))

    return (
        <>
            <StickyHeaderWrapper>
                <LogoText />
                <div className="flex items-center gap-2">
                    <LanguageToggle />
                    <span className="text-bold hidden sm:block">
                        {username}
                    </span>
                    <DropdownMenu>
                        <DropdownMenuTrigger>
                            <Avatar className="border-2 border-slate-400 dark:border-white rounded-full flex justify-center items-center group cursor-pointer">
                                <AvatarImage
                                    src="/logo.png"
                                    alt="@user"
                                />
                                <AvatarFallback>Taidy</AvatarFallback>
                            </Avatar>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>帳戶</DropdownMenuLabel>
                                <Link href="/logout">
                                    <DropdownMenuItem>
                                        登出
                                    </DropdownMenuItem>
                                </Link>
                                {/* <DropdownMenuItem>Billing</DropdownMenuItem> */}
                            </DropdownMenuGroup>
                            {/* <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuItem>Team</DropdownMenuItem>
                                <DropdownMenuItem>Subscription</DropdownMenuItem>
                            </DropdownMenuGroup> */}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </StickyHeaderWrapper>
            {/* // Use fixed width insteawd of %, because Dialog opening somehow change the width. */}
            <div className="w-[95%] mx-auto pt-5 px-4 md:mx-auto flex-1 flex flex-col">
                {/* Desktop: resizable split with notes on the right */}
                <div className="hidden md:flex flex-1">
                    <ResizablePanelGroup
                        direction="horizontal"
                        className="flex-1"
                    >
                        <ResizablePanel defaultSize={75} minSize={50}>
                            <TableMain labels={labels}>
                                <DialogAdminSettings
                                    role={role}
                                    labels={labels}
                                />
                            </TableMain>
                        </ResizablePanel>
                        <ResizableHandle withHandle className="mx-4" />
                        <ResizablePanel defaultSize={25} minSize={15}>
                            <NotesPanel />
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </div>

                {/* Mobile: full-width table, notes via floating button */}
                <div className="md:hidden flex-1">
                    <TableMain labels={labels}>
                        <DialogAdminSettings
                            role={role}
                            labels={labels}
                        />
                    </TableMain>
                </div>

                <NotesMobileTrigger />
                {/* This is fixed positioned */}
                <ButtonBackToTop />
            </div>
        </>

    )
}

export default VaultPage;