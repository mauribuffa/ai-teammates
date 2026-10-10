import "server-only"

import { auth } from "@clerk/nextjs/server"
import { desc, eq } from "drizzle-orm"

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
