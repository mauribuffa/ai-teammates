"use client"

import { useChat } from "@ai-sdk/react"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import { isToolUIPart } from "ai"

import {
  loadTranscript,
  mintChatAccessToken,
  startChatSession,
} from "@/actions/chat"

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
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import type { chatAgent } from "@/trigger/chat"
import type { ChatUIMessage } from "@/trigger/tools"

type Transport = ReturnType<typeof useTriggerChatTransport>
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
}

export function Chat({ chatId }: { chatId: string }) {
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
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
      // The transcript loader is untyped; the agent writes ChatUIMessages.
      initialMessages={messages as ChatUIMessage[]}
    />
  )
}

function ChatView({
  chatId,
  transport,
  initialMessages,
}: {
  chatId: string
  transport: Transport
  initialMessages: ChatUIMessage[]
}) {
  const { messages, sendMessage, status, stop } = useChat<ChatUIMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
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
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
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
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl p-4 pt-0">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
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
