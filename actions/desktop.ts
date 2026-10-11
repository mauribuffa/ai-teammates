"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { chats } from "@/db/schema"
import { daytona } from "@/lib/daytona"

// Port noVNC listens on inside a Daytona sandbox.
const NOVNC_PORT = 6080

// Starts the chat bot's sandbox and desktop if needed, and returns a signed
// noVNC URL for embedding it.
export async function getDesktopUrl(chatId: string) {
  const { userId } = await auth.protect()

  const chat = await db.query.chats.findFirst({
    columns: {},
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      members: {
        columns: {},
        orderBy: (m, { asc }) => asc(m.joinedAt),
        limit: 1,
        with: { bot: { columns: { sandboxId: true } } },
      },
    },
  })
  const sandboxId = chat?.members[0]?.bot.sandboxId
  if (!sandboxId) throw new Error("This chat's bot has no sandbox.")

  const sandbox = await daytona.get(sandboxId)
  if (sandbox.state !== "started") await sandbox.start()
  const { status } = await sandbox.computerUse.getStatus()
  if (status !== "active") await sandbox.computerUse.start()

  const { url } = await sandbox.getSignedPreviewUrl(NOVNC_PORT, 3600)
  const vnc = new URL("/vnc.html", url)
  vnc.searchParams.set("autoconnect", "true")
  vnc.searchParams.set("resize", "scale")
  return vnc.toString()
}
