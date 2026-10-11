import { anthropic } from "@ai-sdk/anthropic"
import { Daytona, type Sandbox } from "@daytona/sdk"
import { parseEnv } from "@neon/env"
import { chat } from "@trigger.dev/sdk/ai"
import { stepCountIs } from "ai"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { z } from "zod"

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

// The bot picked to answer this turn, which must be a member of the chat.
async function getChatBot(chatId: string, botId: string) {
  const member = await db.query.chatMembers.findFirst({
    where: and(
      eq(schema.chatMembers.chatId, chatId),
      eq(schema.chatMembers.botId, botId)
    ),
    with: { bot: true },
  })
  if (!member) throw new Error(`Bot ${botId} isn't in chat ${chatId}`)
  return member.bot
}

// Resolves the bot's sandbox and its desktop on first use, at most once each.
// Called per turn, since the sandbox stops itself when idle.
function lazySandbox(chatId: string, botId: string) {
  let sandbox: Promise<Sandbox> | undefined
  let desktop: Promise<Sandbox> | undefined

  const getSandbox = () =>
    (sandbox ??= (async () => {
      const { sandboxId } = await getChatBot(chatId, botId)
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
// The client sends the bot to talk to with every turn, so in a group chat
// each turn can be answered by a different bot, with its own prompt and sandbox.
export const chatAgent = chat
  .withUIMessage<ChatUIMessage>()
  .withClientData({ schema: z.object({ botId: z.string() }) })
  .agent({
    id: "chat",
    tools: ({ chatId, clientData }) =>
      sandboxTools(lazySandbox(chatId, clientData!.botId)),
    // Loaded every turn so edits to the bot apply to the next message.
    onTurnStart: async ({ chatId, clientData }) => {
      chat.prompt.set(systemPrompt(await getChatBot(chatId, clientData!.botId)))
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
