import { anthropic } from "@ai-sdk/anthropic"
import { parseEnv } from "@neon/env"
import { chat } from "@trigger.dev/sdk/ai"
import { asc, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"

import * as schema from "@/db/schema"
import config from "@/neon"

// Its own client, since "@/db" is guarded by server-only, which throws outside Next.
const { postgres } = parseEnv(config, ["DATABASE_URL"])
const db = drizzle(postgres.databaseUrl, { schema })

// The bot that represents the chat. Group chats aren't handled yet and fall
// back to their first bot.
async function getChatBot(chatId: string) {
  const member = await db.query.chatMembers.findFirst({
    where: eq(schema.chatMembers.chatId, chatId),
    orderBy: asc(schema.chatMembers.joinedAt),
    with: { bot: true },
  })
  if (!member) throw new Error(`Chat ${chatId} has no bot`)
  return member.bot
}

function systemPrompt(bot: typeof schema.bots.$inferSelect) {
  return [
    `You are ${bot.name}, an AI teammate. Your job: ${bot.job}.`,
    "You work alongside the person you're chatting with as a member of their team. Stay in character as " +
      `${bot.name}, keep the conversation focused on your job, and be direct and genuinely helpful.`,
    bot.instructions && `How to go about your job, in your teammate's words:\n${bot.instructions}`,
    "You have your own isolated cloud sandbox: a dedicated Linux computer with its own filesystem, " +
      `provisioned for you alone (sandbox ID: ${bot.sandboxId ?? "not provisioned"}). It is your workspace ` +
      "and persists between conversations.",
  ]
    .filter(Boolean)
    .join("\n\n")
}

// The conversation is kept in the default transcript storage, keyed by chatId.
export const chatAgent = chat.agent({
  id: "chat",
  // Loaded every turn so edits to the bot apply to the next message.
  onTurnStart: async ({ chatId }) => {
    chat.prompt.set(systemPrompt(await getChatBot(chatId)))
  },
  run: async ({ messages, signal, streamText }) =>
    streamText({
      model: anthropic("claude-sonnet-5-5"),
      messages,
      abortSignal: signal,
    }),
})
