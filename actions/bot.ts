"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import type { z } from "zod"

import { db } from "@/db"
import { bots, chatMembers, chats, insertBotSchema } from "@/db/schema"
import { daytona } from "@/lib/daytona"

// Creates the bot together with its direct chat and sandbox, all or nothing.
export async function createBot(input: z.input<typeof insertBotSchema>) {
  const { userId } = await auth.protect()

  const values = insertBotSchema.parse(input)

  // IDs are generated up front so the inserts can reference each other.
  const botId = nanoid()
  const chatId = nanoid()

  const sandbox = await daytona.create({ labels: { botId, userId } })

  let bot
  try {
    // The bot's long-term memory, which it keeps up to date itself. Created
    // with a command, since the SDK's file uploads break under Next's runtime.
    await sandbox.process.executeCommand("touch MEMORY.md")
    bot = await db.transaction(async (tx) => {
      const [bot] = await tx
        .insert(bots)
        .values({
          ...values,
          id: botId,
          instructions: values.instructions || null,
          sandboxId: sandbox.id,
          userId,
        })
        .returning()
      await tx.insert(chats).values({ id: chatId, userId, kind: "direct" })
      await tx.insert(chatMembers).values({ chatId, botId })
      return bot
    })
  } catch (error) {
    // Don't leave an orphaned sandbox behind.
    await daytona.delete(sandbox).catch(() => {})
    throw error
  }

  revalidatePath("/")

  return bot
}

export async function updateBot(id: string, input: z.input<typeof insertBotSchema>) {
  const { userId } = await auth.protect()

  const values = insertBotSchema.parse(input)

  const [bot] = await db
    .update(bots)
    .set({ ...values, instructions: values.instructions || null })
    .where(and(eq(bots.id, id), eq(bots.userId, userId)))
    .returning()
  if (!bot) throw new Error("Bot not found")

  // The bot's name and face show in the sidebar and chat headers.
  revalidatePath("/", "layout")

  return bot
}

// Deletes the bot together with its sandbox and its direct chats, which would be left empty.
export async function deleteBot(id: string) {
  const { userId } = await auth.protect()

  const bot = await db.transaction(async (tx) => {
    const directChats = tx
      .select({ id: chatMembers.chatId })
      .from(chatMembers)
      .innerJoin(chats, eq(chats.id, chatMembers.chatId))
      .where(and(eq(chatMembers.botId, id), eq(chats.kind, "direct")))
    await tx
      .delete(chats)
      .where(and(inArray(chats.id, directChats), eq(chats.userId, userId)))
    const [bot] = await tx
      .delete(bots)
      .where(and(eq(bots.id, id), eq(bots.userId, userId)))
      .returning()
    if (!bot) throw new Error("Bot not found")
    return bot
  })

  if (bot.sandboxId) {
    await daytona.delete(await daytona.get(bot.sandboxId))
  }

  revalidatePath("/", "layout")

  return bot
}
