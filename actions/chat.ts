"use server"

import { auth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"

import { getChat } from "@/queries/chats"
import type { chatAgent } from "@/trigger/chat"

const startSession = chat.createStartSessionAction<typeof chatAgent>("chat")
const loadChatTranscript = chat.createLoadTranscriptAction(defaultStorage)

// The chatId comes from the browser, so every action checks that the
// signed-in user owns the chat before touching its session or transcript.
async function assertOwnsChat(chatId: string) {
  if (!(await getChat(chatId))) throw new Error("Chat not found.")
}

export async function startChatSession(
  params: Parameters<typeof startSession>[0]
) {
  await assertOwnsChat(params.chatId)
  return startSession(params)
}

export async function mintChatAccessToken(chatId: string) {
  await assertOwnsChat(chatId)
  return auth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  })
}

export async function loadTranscript(
  params: Parameters<typeof loadChatTranscript>[0]
) {
  await assertOwnsChat(params.chatId)
  return loadChatTranscript(params)
}
