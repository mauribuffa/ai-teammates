import { anthropic } from "@ai-sdk/anthropic"
import { Daytona, type Sandbox } from "@daytona/sdk"
import { parseEnv } from "@neon/env"
import { chat } from "@trigger.dev/sdk/ai"
import { stepCountIs } from "ai"
import { asc, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"

import * as schema from "@/db/schema"
import config from "@/neon"

import { sandboxTools, type ChatUIMessage } from "./tools"

// Its own clients, since "@/db" and "@/lib/daytona" are guarded by
// server-only, which throws outside Next.
const { postgres } = parseEnv(config, ["DATABASE_URL"])
const db = drizzle(postgres.databaseUrl, { schema })
// Passed explicitly, see lib/daytona.ts.
const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY,
  apiUrl: process.env.DAYTONA_API_URL,
})

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

// Resolves the chat bot's sandbox and its desktop on first use, at most once
// each. Called per turn, since the sandbox stops itself when idle.
function lazySandbox(chatId: string) {
  let sandbox: Promise<Sandbox> | undefined
  let desktop: Promise<Sandbox> | undefined

  const getSandbox = () =>
    (sandbox ??= (async () => {
      const { sandboxId } = await getChatBot(chatId)
      if (!sandboxId) throw new Error("This bot has no sandbox.")
      const sandbox = await daytona.get(sandboxId)
      if (sandbox.state !== "started") await sandbox.start()
      return sandbox
    })())

  const getDesktop = () =>
    (desktop ??= (async () => {
      const sandbox = await getSandbox()
      const { status } = await sandbox.computerUse.getStatus()
      if (status !== "active") await sandbox.computerUse.start()
      return sandbox
    })())

  return { getSandbox, getDesktop }
}

function systemPrompt(bot: typeof schema.bots.$inferSelect) {
  return [
    `You are ${bot.name}, an AI teammate. Your job: ${bot.job}.`,
    "You work alongside the person you're chatting with as a member of their team. Stay in character as " +
      `${bot.name}, keep the conversation focused on your job, and be direct and genuinely helpful.`,
    bot.instructions &&
      `How to go about your job, in your teammate's words:\n${bot.instructions}`,
    "You have your own isolated cloud sandbox: a dedicated Linux computer with its own filesystem, " +
      `provisioned for you alone (sandbox ID: ${bot.sandboxId ?? "not provisioned"}). It is your workspace ` +
      "and persists between conversations.",
    "Use your tools to work in the sandbox: run commands, read and write files, and operate its 1024x768 " +
      "desktop with the mouse and keyboard. Prefer commands and files when they can do the job. When you " +
      "use the desktop, look at the screen before acting and check it again afterwards to confirm the result.",
  ]
    .filter(Boolean)
    .join("\n\n")
}

// The conversation is kept in the default transcript storage, keyed by chatId.
export const chatAgent = chat.withUIMessage<ChatUIMessage>().agent({
  id: "chat",
  tools: ({ chatId }) => sandboxTools(lazySandbox(chatId)),
  // Loaded every turn so edits to the bot apply to the next message.
  onTurnStart: async ({ chatId }) => {
    chat.prompt.set(systemPrompt(await getChatBot(chatId)))
  },
  run: async ({ messages, tools, signal, streamText }) =>
    streamText({
      model: anthropic("claude-sonnet-5-5"),
      messages,
      tools,
      abortSignal: signal,
      stopWhen: stepCountIs(50),
    }),
})
