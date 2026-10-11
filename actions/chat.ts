"use server"

import { auth as clerkAuth } from "@clerk/nextjs/server"
import { auth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { and, eq, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import type { z } from "zod"

import { db } from "@/db"
import { bots, chatMembers, chats, insertGroupChatSchema } from "@/db/schema"
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

// Creates a group chat with the picked bots, which must all be the user's.
export async function createGroupChat(
  input: z.input<typeof insertGroupChatSchema>
) {
  const { userId } = await clerkAuth.protect()

  const values = insertGroupChatSchema.parse(input)
  const botIds = [...new Set(values.botIds)]

  const owned = await db
    .select({ id: bots.id })
    .from(bots)
    .where(and(inArray(bots.id, botIds), eq(bots.userId, userId)))
  if (owned.length !== botIds.length) throw new Error("Bot not found")

  const chatId = nanoid()
  const created = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(chats)
      .values({ id: chatId, userId, kind: "group", name: values.name })
      .returning()
    // Members are ordered by joinedAt, so space them out to keep the picked order.
    const now = Date.now()
    await tx.insert(chatMembers).values(
      botIds.map((botId, i) => ({ chatId, botId, joinedAt: new Date(now + i) }))
    )
    return created
  })

  revalidatePath("/")

  return created
}
