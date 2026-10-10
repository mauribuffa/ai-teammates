import { MonitorIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { Button } from "@/components/ui/button"
import type { ChatDetail } from "@/queries/chats"

export function ChatHeader({ chat }: { chat: ChatDetail }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <BotDialog bot={chat.bot} />
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
