"use client"

import { MonitorIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { useDesktopPanel } from "@/components/desktop-panel"
import { Button } from "@/components/ui/button"
import type { ChatDetail } from "@/queries/chats"

export function ChatHeader({ chat }: { chat: ChatDetail }) {
  const desktop = useDesktopPanel()

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <BotDialog bot={chat.bot} />
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
    </header>
  )
}
