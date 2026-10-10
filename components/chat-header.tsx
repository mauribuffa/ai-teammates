import { MonitorIcon } from "lucide-react"

import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import type { ChatDetail } from "@/queries/chats"

export function ChatHeader({ chat }: { chat: ChatDetail }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <ChatAvatar seed={chat.bot.avatar} className="size-6" />
      <h1 className="truncate text-sm font-medium">
        {chat.name ?? chat.bot.name}
      </h1>
      {/* Placeholder: does nothing yet. */}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Desktop"
        className="ms-auto text-muted-foreground"
      >
        <MonitorIcon />
      </Button>
    </header>
  )
}
