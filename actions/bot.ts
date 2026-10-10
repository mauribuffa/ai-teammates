"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import type { z } from "zod"

import { db } from "@/db"
import { bots, insertBotSchema } from "@/db/schema"

export async function createBot(input: z.input<typeof insertBotSchema>) {
  const { userId } = await auth.protect()

  const values = insertBotSchema.parse(input)

  const [bot] = await db
    .insert(bots)
    .values({ ...values, instructions: values.instructions || null, userId })
    .returning()

  revalidatePath("/")

  return bot
}
