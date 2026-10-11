"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { formatDistanceToNowStrict } from "date-fns"
import { PlusIcon, UsersIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { GroupAvatar } from "@/components/chat-avatar"
import { ChatSearch } from "@/components/chat-search"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { BotSummary, Chat } from "@/queries/chats"

const subscribe = () => () => {}

// The menu unmounts its items on close, so the dialogs live outside the menu
// and the items open them through these handles.
const botDialog = DialogPrimitive.createHandle()
const groupChatDialog = DialogPrimitive.createHandle()

export function AppSidebar({
  chats,
  bots,
}: {
  chats: Chat[]
  bots: BotSummary[]
}) {
  // Clerk renders UserButton only once clerk-js has loaded, which can already
  // be true when this subtree hydrates, so the server HTML (empty) wouldn't
  // match. Render it after hydration instead.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
  const { chatId } = useParams<{ chatId?: string }>()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="New"
                className="self-end"
              />
            }
          >
            <PlusIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            <DropdownMenuItem onClick={() => botDialog.open(null)}>
              <PlusIcon />
              Create new bot
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => groupChatDialog.open(null)}>
              <UsersIcon />
              Create group chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <BotDialog handle={botDialog} />
        <GroupChatDialog handle={groupChatDialog} bots={bots} />
        <ChatSearch chats={chats} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {chats.map((chat) => {
              const name = chat.name ?? chat.bots[0].name
              return (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={name}
                    isActive={chat.id === chatId}
                    render={<Link href={`/chats/${chat.id}`} />}
                  >
                    <GroupAvatar bots={chat.bots} />
                    <div className="grid min-w-0 flex-1 leading-tight">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate font-medium">{name}</span>
                        <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNowStrict(chat.lastMessageAt)}
                        </span>
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {chat.lastMessagePreview}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* UserButton renders its own <button>, so the menu button is a
                div wrapper and Clerk's trigger fills it edge to edge. */}
            <SidebarMenuButton
              render={<div />}
              className="p-0 group-data-[collapsible=icon]:p-0! has-focus-visible:ring-2"
            >
              {/* Clerk's styles are unlayered, so `!` is needed to beat them. */}
              {hydrated && (
                <UserButton
                  showName
                  appearance={{
                    elements: {
                      rootBox: "size-full!",
                      userButtonTrigger:
                        "size-full! rounded-[inherit]! p-2! group-data-[collapsible=icon]:p-1! bg-transparent! text-inherit! shadow-none! outline-none!",
                      userButtonBox:
                        "w-full! flex-row-reverse! justify-end! gap-2!",
                      userButtonAvatarBox: "size-6! rounded-full!",
                      userButtonOuterIdentifier:
                        "truncate ps-0! text-sm! font-normal! text-inherit! group-data-[collapsible=icon]:hidden!",
                    },
                  }}
                />
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
