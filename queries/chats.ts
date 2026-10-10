import "server-only"

import { auth } from "@clerk/nextjs/server"
import { and, desc, eq } from "drizzle-orm"

import { db } from "@/db"
import { chats } from "@/db/schema"

// The signed-in user's chats, most recent first, each with the bot that
// represents it. Group chats aren't handled yet and fall back to their first bot.
export async function getChats() {
  const { userId } = await auth.protect()

  const rows = await db.query.chats.findMany({
    columns: { id: true, name: true, lastMessagePreview: true, lastMessageAt: true },
    where: eq(chats.userId, userId),
    orderBy: desc(chats.lastMessageAt),
    with: {
      members: {
        columns: {},
        orderBy: (m, { asc }) => asc(m.joinedAt),
        limit: 1,
        with: { bot: { columns: { name: true, avatar: true } } },
      },
    },
  })

  return rows.flatMap(({ members, ...chat }) => {
    const bot = members[0]?.bot
    return bot ? [{ ...chat, bot }] : []
  })
}

export type Chat = Awaited<ReturnType<typeof getChats>>[number]

// One of the signed-in user's chats with the bot that represents it, or null
// if it doesn't exist or belongs to someone else. Group chats aren't handled
// yet and fall back to their first bot.
export async function getChat(chatId: string) {
  const { userId } = await auth.protect()

  const row = await db.query.chats.findFirst({
    columns: { id: true, name: true },
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      members: {
        columns: {},
        orderBy: (m, { asc }) => asc(m.joinedAt),
        limit: 1,
        with: { bot: { columns: { name: true, avatar: true } } },
      },
    },
  })

  const bot = row?.members[0]?.bot
  if (!row || !bot) return null

  return { id: row.id, name: row.name, bot }
}

export type ChatDetail = NonNullable<Awaited<ReturnType<typeof getChat>>>
