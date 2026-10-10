"use server"

import { auth } from "@clerk/nextjs/server"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import type { z } from "zod"

import { db } from "@/db"
import { bots, chatMembers, chats, insertBotSchema } from "@/db/schema"

// Creates the bot together with its direct chat, all or nothing.
export async function createBot(input: z.input<typeof insertBotSchema>) {
  const { userId } = await auth.protect()

  const values = insertBotSchema.parse(input)

  // IDs are generated up front so the inserts can reference each other.
  const botId = nanoid()
  const chatId = nanoid()

  const bot = await db.transaction(async (tx) => {
    const [bot] = await tx
      .insert(bots)
      .values({ ...values, id: botId, instructions: values.instructions || null, userId })
      .returning()
    await tx.insert(chats).values({ id: chatId, userId, kind: "direct" })
    await tx.insert(chatMembers).values({ chatId, botId })
    return bot
  })

  revalidatePath("/")

  return bot
}
