import { anthropic } from "@ai-sdk/anthropic"
import { Daytona, type Sandbox } from "@daytona/sdk"
import { parseEnv } from "@neon/env"
import { chat } from "@trigger.dev/sdk/ai"
import { hasToolCall, stepCountIs } from "ai"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { z } from "zod"

import * as schema from "@/db/schema"
import config from "@/neon"

import {
  handoffTool,
  sandboxTools,
  type ChatTools,
  type ChatUIMessage,
} from "./tools"

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

// The chat and the bot answering this turn, plus the bot's teammates: the
// chat's other bots, which group chats can hand off to.
async function getTurnContext(chatId: string, botId: string) {
  const row = await db.query.chats.findFirst({
    columns: { kind: true, name: true },
    where: eq(schema.chats.id, chatId),
    with: {
      members: {
        columns: {},
        orderBy: (m, { asc }) => asc(m.joinedAt),
        with: { bot: true },
      },
    },
  })
  const bot = row?.members.find((m) => m.bot.id === botId)?.bot
  if (!row || !bot) throw new Error(`Bot ${botId} isn't in chat ${chatId}`)
  const teammates = row.members.map((m) => m.bot).filter((b) => b.id !== botId)
  return { chat: row, bot, teammates }
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

function systemPrompt({
  chat,
  bot,
  teammates,
}: Awaited<ReturnType<typeof getTurnContext>>) {
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
    "Your memory: the file MEMORY.md in your sandbox (pass the path as just `MEMORY.md`) is your long-term " +
      "memory, and the only way you remember anything across chats. You don't see your other conversations, " +
      "so anything not written there is forgotten once this chat ends.",
    "When the person tells you something worth remembering, such as facts about them or their work, " +
      "preferences, decisions, ongoing tasks, or anything they ask you to remember, add it to MEMORY.md " +
      "right away: read it first, then write it back with the new entry. Keep it short, organized by topic, " +
      "and current: update or remove entries instead of piling up duplicates. Don't store secrets like " +
      "passwords or keys.",
    "Before answering anything that could depend on what you learned in another conversation, such as " +
      "being asked what you know, what was said or decided before, or about the person's preferences, " +
      "read MEMORY.md first and answer from it. Say so plainly if it doesn't have the answer instead of guessing.",
    chat.kind === "group" && groupPrompt(chat.name, teammates),
  ]
    .filter(Boolean)
    .join("\n\n")
}

function groupPrompt(
  name: string | null,
  teammates: (typeof schema.bots.$inferSelect)[]
) {
  return [
    `This is a group chat${name ? ` called "${name}"` : ""}. Besides the person, it has these teammates, ` +
      "each an AI teammate like you with its own job and its own sandbox:\n" +
      teammates.map((t) => `- ${t.name} (ID: ${t.id}): ${t.job}`).join("\n"),
    "The person picks who answers each message, and this time it's you. Earlier assistant replies in this " +
      "conversation may have been written by teammates rather than you: don't take credit for their work, " +
      "and remember that files they made live in their sandboxes, not yours.",
    "You can't see your private one-on-one chat with the person here, so check MEMORY.md whenever they refer " +
      "to something they told you before or that only you would know.",
    "Besides your sandbox tools, you have a handoff tool. If the person's latest request clearly belongs to " +
      "a teammate's job rather than yours, call handoff with their ID instead of answering, and they answer " +
      "next in your place. Don't hand off what you can do well yourself, and never hand a request back to " +
      "the teammate who just handed it to you.",
    "If a teammate has just handed the request to you, answer the person's latest message yourself.",
  ].join("\n\n")
}

// The conversation is kept in the default transcript storage, keyed by chatId.
// The client sends the bot to talk to with every turn, so in a group chat
// each turn can be answered by a different bot, with its own prompt and sandbox.
export const chatAgent = chat
  .withUIMessage<ChatUIMessage>()
  .withClientData({ schema: z.object({ botId: z.string() }) })
  .agent({
    id: "chat",
    tools: async ({ chatId, clientData }): Promise<ChatTools> => {
      const { botId } = clientData!
      const context = await getTurnContext(chatId, botId)
      const tools = sandboxTools(lazySandbox(chatId, botId))
      return context.chat.kind === "group"
        ? { ...tools, handoff: handoffTool(context.teammates) }
        : tools
    },
    // After a handoff the client sends this action with the teammate as its
    // bot, which runs a turn answered by them.
    actionSchema: z.object({ type: z.literal("handoff") }),
    onAction: () => chat.turn(),
    // Loaded every turn so edits to the bot apply to the next message.
    onTurnStart: async ({ chatId, clientData }) => {
      const { botId } = clientData!
      chat.prompt.set(systemPrompt(await getTurnContext(chatId, botId)))
      // Stamps the reply with its bot, so the client shows who wrote it.
      chat.setUIMessageStreamOptions({ messageMetadata: () => ({ botId }) })
    },
    run: async ({ messages, tools, signal, streamText }) =>
      streamText({
        model: anthropic("claude-sonnet-5-5"),
        messages,
        tools,
        abortSignal: signal,
        // A handoff ends the turn; the teammate answers in the next one.
        stopWhen: [stepCountIs(50), hasToolCall("handoff")],
      }),
  })
