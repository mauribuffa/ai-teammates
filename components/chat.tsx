"use client"

import { useChat } from "@ai-sdk/react"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import { isToolUIPart } from "ai"
import { useState } from "react"

import {
  loadTranscript,
  mintChatAccessToken,
  startChatSession,
} from "@/actions/chat"

import { ChatAvatar } from "@/components/chat-avatar"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Image } from "@/components/ai-elements/image"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import type { ChatDetail } from "@/queries/chats"
import type { chatAgent } from "@/trigger/chat"
import type { ChatUIMessage } from "@/trigger/tools"

type Transport = ReturnType<typeof useTriggerChatTransport>
type Bot = ChatDetail["bots"][number]
type ToolPart = Extract<
  ChatUIMessage["parts"][number],
  { type: `tool-${string}` }
>

const toolTitles: Record<ToolPart["type"], string> = {
  "tool-bash": "Run command",
  "tool-readFile": "Read file",
  "tool-writeFile": "Write file",
  "tool-listFiles": "List files",
  "tool-mouseClick": "Click",
  "tool-mouseMove": "Move mouse",
  "tool-mouseDrag": "Drag",
  "tool-mouseScroll": "Scroll",
  "tool-keyboardType": "Type",
  "tool-keyboardPress": "Press key",
  "tool-viewScreen": "Look at screen",
  "tool-showScreen": "Show screen",
  "tool-handoff": "Hand off",
}

export function Chat({ chatId, bots }: { chatId: string; bots: Bot[] }) {
  // The bot that answers the next message. Sent with every turn, so picking
  // another one switches who replies.
  const [pickedBotId, setBotId] = useState(bots[0].id)
  // Falls back to the first bot if the picked one was removed from the group.
  const botId = bots.some((bot) => bot.id === pickedBotId)
    ? pickedBotId
    : bots[0].id
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    clientData: { botId },
  })
  const { messages, isLoading } = useLoadTranscript(chatId, loadTranscript, {
    transport,
  })

  // useChat must mount after the transcript loads so its initial messages
  // and the transport's resume cursor describe the same transcript.
  if (isLoading) return <div className="flex-1" />

  return (
    <ChatView
      key={chatId}
      chatId={chatId}
      transport={transport}
      bots={bots}
      botId={botId}
      onBotChange={setBotId}
      // The transcript loader is untyped; the agent writes ChatUIMessages.
      initialMessages={messages as ChatUIMessage[]}
    />
  )
}

function ChatView({
  chatId,
  transport,
  bots,
  botId,
  onBotChange,
  initialMessages,
}: {
  chatId: string
  transport: Transport
  bots: Bot[]
  botId: string
  onBotChange: (botId: string) => void
  initialMessages: ChatUIMessage[]
}) {
  const { messages, sendMessage, status, stop } = useChat<ChatUIMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
    // A bot that hands off ends its turn; switch to the teammate and ask for
    // their turn, with them as the bot.
    onFinish: ({ message, isAbort, isError }) => {
      if (isAbort || isError) return
      const handoff = message.parts.findLast(
        (part) => part.type === "tool-handoff"
      )
      if (handoff?.state !== "output-available") return
      const { botId } = handoff.output
      onBotChange(botId)
      sendMessage(undefined, {
        body: { action: { type: "handoff" } },
        metadata: { botId },
      })
    },
  })

  function handleSubmit(message: PromptInputMessage) {
    if (!message.text.trim()) return
    sendMessage({ text: message.text })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState />
          ) : (
            messages.map((message) => {
              // Group chats show which bot wrote each reply.
              const author =
                bots.length > 1 &&
                message.role === "assistant" &&
                bots.find((bot) => bot.id === message.metadata?.botId)
              return (
                <Message
                  from={message.role}
                  key={message.id}
                  className={author ? "flex-row items-start" : undefined}
                >
                  {author && <ChatAvatar seed={author.avatar} />}
                  <MessageContent>
                    {message.parts.map((part, i) => {
                      if (part.type === "text") {
                        return (
                          <MessageResponse key={`${message.id}-${i}`}>
                            {part.text}
                          </MessageResponse>
                        )
                      }
                      if (isToolUIPart(part) && part.type !== "dynamic-tool") {
                        return <ToolCall key={part.toolCallId} part={part} />
                      }
                      return null
                    })}
                  </MessageContent>
                </Message>
              )
            })
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl p-4 pt-0">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              {bots.length > 1 && (
                <BotSelect bots={bots} value={botId} onChange={onBotChange} />
              )}
            </PromptInputTools>
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

function BotSelect({
  bots,
  value,
  onChange,
}: {
  bots: Bot[]
  value: string
  onChange: (botId: string) => void
}) {
  const findBot = (id: string) => bots.find((bot) => bot.id === id)

  return (
    <PromptInputSelect
      value={value}
      // The wrapper loses Select's value type; the values are bot IDs.
      onValueChange={(next) => typeof next === "string" && onChange(next)}
    >
      <PromptInputSelectTrigger size="sm" aria-label="Bot to talk to">
        <PromptInputSelectValue>
          {(id: string) => {
            const bot = findBot(id)
            return (
              bot && (
                <>
                  <ChatAvatar seed={bot.avatar} className="size-5" />
                  {bot.name}
                </>
              )
            )
          }}
        </PromptInputSelectValue>
      </PromptInputSelectTrigger>
      {/* Sized to the items, which are wider than the trigger, so the job
          doesn't run under the check. */}
      <PromptInputSelectContent
        alignItemWithTrigger={false}
        side="top"
        className="w-auto min-w-(--anchor-width)"
      >
        {bots.map((bot) => (
          <PromptInputSelectItem key={bot.id} value={bot.id}>
            <ChatAvatar seed={bot.avatar} className="size-8" />
            <div className="grid leading-tight">
              <span className="font-medium">{bot.name}</span>
              <span className="text-xs text-muted-foreground">{bot.job}</span>
            </div>
          </PromptInputSelectItem>
        ))}
      </PromptInputSelectContent>
    </PromptInputSelect>
  )
}

function ToolCall({ part }: { part: ToolPart }) {
  // Screenshots are base64 images, so they never go through ToolOutput.
  // viewScreen's is for the agent alone; showScreen's is shown to the user.
  const isScreenshot =
    part.type === "tool-viewScreen" || part.type === "tool-showScreen"

  return (
    <>
      <Tool>
        <ToolHeader
          type={part.type}
          state={part.state}
          title={toolTitles[part.type]}
        />
        <ToolContent>
          {!isScreenshot && <ToolInput input={part.input} />}
          <ToolOutput
            output={isScreenshot ? undefined : part.output}
            errorText={part.errorText}
          />
        </ToolContent>
      </Tool>
      {part.type === "tool-showScreen" && part.state === "output-available" && (
        <Image
          base64={part.output.base64}
          mediaType={part.output.mediaType}
          uint8Array={new Uint8Array()}
          alt="Screenshot of the sandbox desktop"
          className="border"
        />
      )}
    </>
  )
}
