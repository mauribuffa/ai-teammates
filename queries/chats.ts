import "server-only"

import { auth } from "@clerk/nextjs/server"
import { and, asc, desc, eq } from "drizzle-orm"

import { db } from "@/db"
import { bots, chats } from "@/db/schema"

// The signed-in user's chats, most recent first, each with its bots in the
// order they joined.
export async function getChats() {
  const { userId } = await auth.protect()

  const rows = await db.query.chats.findMany({
    columns: { id: true, kind: true, name: true, lastMessagePreview: true, lastMessageAt: true },
    where: eq(chats.userId, userId),
    orderBy: desc(chats.lastMessageAt),
    with: {
      members: {
        columns: {},
        orderBy: (m, { asc }) => asc(m.joinedAt),
        with: { bot: { columns: { name: true, avatar: true } } },
      },
    },
  })

  return rows.flatMap(({ members, ...chat }) => {
    const bots = members.map((m) => m.bot)
    return bots.length ? [{ ...chat, bots }] : []
  })
}

export type Chat = Awaited<ReturnType<typeof getChats>>[number]

// One of the signed-in user's chats with its bots (with their editable
// fields) in the order they joined, or null if it doesn't exist or belongs to
// someone else.
export async function getChat(chatId: string) {
  const { userId } = await auth.protect()

  const row = await db.query.chats.findFirst({
    columns: { id: true, kind: true, name: true },
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      members: {
        columns: {},
        orderBy: (m, { asc }) => asc(m.joinedAt),
        with: {
          bot: {
            columns: { id: true, name: true, avatar: true, job: true, instructions: true },
          },
        },
      },
    },
  })

  const bots = row?.members.map((m) => m.bot) ?? []
  if (!row || !bots.length) return null

  return { id: row.id, kind: row.kind, name: row.name, bots }
}

export type ChatDetail = NonNullable<Awaited<ReturnType<typeof getChat>>>

// The signed-in user's bots, oldest first.
export async function getBots() {
  const { userId } = await auth.protect()

  return db.query.bots.findMany({
    columns: { id: true, name: true, avatar: true },
    where: eq(bots.userId, userId),
    orderBy: asc(bots.createdAt),
  })
}

export type BotSummary = Awaited<ReturnType<typeof getBots>>[number]
