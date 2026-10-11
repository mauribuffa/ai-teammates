import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
import { DesktopPanel, DesktopPanelProvider } from "@/components/desktop-panel"
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { getChat } from "@/queries/chats"

export default async function Page(props: PageProps<"/chats/[chatId]">) {
  const { chatId } = await props.params
  const chat = await getChat(chatId)
  if (!chat) notFound()

  const main = (
    <div className="flex h-full flex-col">
      <ChatHeader chat={chat} />
      <Chat chatId={chat.id} bots={chat.bots} />
    </div>
  )

  // Group chats have no desktop panel.
  if (chat.kind === "group") return <div className="h-svh">{main}</div>

  return (
    <DesktopPanelProvider chatId={chat.id}>
      {/* The group sizes itself to 100% of its parent inline, so the parent
          caps the height to keep only the chat messages scrolling. */}
      <div className="h-svh">
        <ResizablePanelGroup>
          <ResizablePanel id="chat" minSize="30%" className="h-full">
            {main}
          </ResizablePanel>
          <DesktopPanel />
        </ResizablePanelGroup>
      </div>
    </DesktopPanelProvider>
  )
}
