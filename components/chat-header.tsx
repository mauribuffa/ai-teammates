"use client"

import { MonitorIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { GroupAvatar } from "@/components/chat-avatar"
import { useDesktopPanel } from "@/components/desktop-panel"
import { Button } from "@/components/ui/button"
import type { ChatDetail } from "@/queries/chats"

// Group chats have no desktop, so only direct chats get the panel toggle.
export function ChatHeader({ chat }: { chat: ChatDetail }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      {chat.kind === "group" ? (
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <GroupAvatar bots={chat.bots} className="size-6" />
          <span className="truncate font-medium">{chat.name}</span>
        </div>
      ) : (
        <>
          <BotDialog bot={chat.bots[0]} />
          <DesktopToggle />
        </>
      )}
    </header>
  )
}

function DesktopToggle() {
  const desktop = useDesktopPanel()

  return (
    <Button
      variant={desktop.open ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label="Desktop"
      aria-pressed={desktop.open}
      onClick={desktop.toggle}
      className="ms-auto text-muted-foreground"
    >
      <MonitorIcon />
    </Button>
  )
}
