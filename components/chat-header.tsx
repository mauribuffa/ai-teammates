"use client"

import { MonitorIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { useDesktopPanel } from "@/components/desktop-panel"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import type { BotSummary, ChatDetail } from "@/queries/chats"

// Group chats have no desktop, so only direct chats get the panel toggle.
// bots are all the user's bots, which a group chat's members are picked from.
export function ChatHeader({
  chat,
  bots,
}: {
  chat: ChatDetail
  bots: BotSummary[]
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      {chat.kind === "group" ? (
        <GroupChatDialog chat={chat} bots={bots} />
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
