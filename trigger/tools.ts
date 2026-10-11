import type { Sandbox } from "@daytona/sdk"
import { tool, type InferUITools, type UIDataTypes, type UIMessage } from "ai"
import { z } from "zod"

// Keeps tool output from flooding the model's context.
const MAX_OUTPUT = 20_000

function truncate(text: string) {
  return text.length > MAX_OUTPUT
    ? `${text.slice(0, MAX_OUTPUT)}\n… [truncated ${text.length - MAX_OUTPUT} characters]`
    : text
}

async function screenshot(sandbox: Sandbox) {
  const { screenshot } = await sandbox.computerUse.screenshot.takeCompressed({
    format: "jpeg",
    quality: 75,
    showCursor: true,
  })
  if (!screenshot) throw new Error("The screenshot came back empty.")
  return { mediaType: "image/jpeg", base64: screenshot }
}

const screenshotOutput = ({
  output,
}: {
  output: { mediaType: string; base64: string }
}) => ({
  type: "content" as const,
  value: [
    {
      type: "file" as const,
      data: { type: "data" as const, data: output.base64 },
      mediaType: output.mediaType,
    },
  ],
})

const point = { x: z.number().int().min(0), y: z.number().int().min(0) }

// Tools that act on the bot's sandbox. `getSandbox` resolves it on first use.
// `getDesktop` additionally makes sure the desktop is running.
export function sandboxTools({
  getSandbox,
  getDesktop,
}: {
  getSandbox: () => Promise<Sandbox>
  getDesktop: () => Promise<Sandbox>
}) {
  return {
    bash: tool({
      description:
        "Run a shell command in your sandbox and get its output. Commands run non-interactively with a " +
        "2 minute timeout. To launch a GUI app on the desktop, run it in the background with DISPLAY=:0, " +
        "e.g. `DISPLAY=:0 chromium >/dev/null 2>&1 &`.",
      inputSchema: z.object({
        command: z.string().describe("The shell command to run."),
        cwd: z
          .string()
          .optional()
          .describe("Working directory. Defaults to the home directory."),
      }),
      execute: async ({ command, cwd }) => {
        const sandbox = await getSandbox()
        const { exitCode, result } = await sandbox.process.executeCommand(
          command,
          cwd,
          undefined,
          120
        )
        return { exitCode, output: truncate(result) }
      },
    }),

    readFile: tool({
      description: "Read a text file from your sandbox.",
      inputSchema: z.object({ path: z.string().describe("Path to the file.") }),
      execute: async ({ path }) => {
        const sandbox = await getSandbox()
        const content = await sandbox.fs.downloadFile(path)
        return { content: truncate(content.toString("utf8")) }
      },
    }),

    writeFile: tool({
      description:
        "Write a text file to your sandbox, replacing it if it exists.",
      inputSchema: z.object({
        path: z.string().describe("Path to the file."),
        content: z.string().describe("The full file contents."),
      }),
      execute: async ({ path, content }) => {
        const sandbox = await getSandbox()
        await sandbox.fs.uploadFile(Buffer.from(content), path)
        return { path, bytes: Buffer.byteLength(content) }
      },
    }),

    listFiles: tool({
      description: "List the files and directories at a path in your sandbox.",
      inputSchema: z.object({
        path: z.string().describe("Directory to list."),
      }),
      execute: async ({ path }) => {
        const sandbox = await getSandbox()
        const files = await sandbox.fs.listFiles(path)
        return files.map((f) => ({
          name: f.name,
          isDir: f.isDir,
          size: f.size,
        }))
      },
    }),

    mouseClick: tool({
      description:
        "Click the mouse at a point on the desktop, in screen pixels.",
      inputSchema: z.object({
        ...point,
        button: z.enum(["left", "right", "middle"]).default("left"),
        double: z
          .boolean()
          .default(false)
          .describe("Double-click instead of a single click."),
      }),
      execute: async ({ x, y, button, double }) => {
        const sandbox = await getDesktop()
        await sandbox.computerUse.mouse.click(x, y, button, double)
        return { x, y }
      },
    }),

    mouseMove: tool({
      description:
        "Move the mouse to a point on the desktop, in screen pixels.",
      inputSchema: z.object(point),
      execute: async ({ x, y }) => {
        const sandbox = await getDesktop()
        await sandbox.computerUse.mouse.move(x, y)
        return { x, y }
      },
    }),

    mouseDrag: tool({
      description:
        "Drag the mouse from one point on the desktop to another, in screen pixels.",
      inputSchema: z.object({
        startX: z.number().int().min(0),
        startY: z.number().int().min(0),
        endX: z.number().int().min(0),
        endY: z.number().int().min(0),
      }),
      execute: async ({ startX, startY, endX, endY }) => {
        const sandbox = await getDesktop()
        await sandbox.computerUse.mouse.drag(startX, startY, endX, endY)
        return { x: endX, y: endY }
      },
    }),

    mouseScroll: tool({
      description: "Scroll the mouse wheel at a point on the desktop.",
      inputSchema: z.object({
        ...point,
        direction: z.enum(["up", "down", "left", "right"]),
        amount: z
          .number()
          .int()
          .min(1)
          .max(30)
          .default(3)
          .describe("Wheel ticks to scroll."),
      }),
      execute: async ({ x, y, direction, amount }) => {
        const sandbox = await getDesktop()
        await sandbox.computerUse.mouse.scroll(x, y, direction, amount)
        return { x, y, direction, amount }
      },
    }),

    keyboardType: tool({
      description:
        "Type text on the desktop as if from a keyboard. Newlines press Enter.",
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => {
        const sandbox = await getDesktop()
        await sandbox.computerUse.keyboard.type(text)
        return { typed: text.length }
      },
    }),

    keyboardPress: tool({
      description:
        "Press a key on the desktop, optionally with modifiers. Keys: enter, escape, tab, backspace, " +
        "delete, space, arrows (up, down, left, right), home, end, pageup, pagedown, f1-f24, letters, digits.",
      inputSchema: z.object({
        key: z.string().describe('The key, e.g. "enter" or "c".'),
        modifiers: z
          .array(z.enum(["ctrl", "alt", "shift", "cmd"]))
          .default([])
          .describe('Modifiers to hold, e.g. ["ctrl"] for Ctrl+C.'),
      }),
      execute: async ({ key, modifiers }) => {
        const sandbox = await getDesktop()
        await sandbox.computerUse.keyboard.press(key, modifiers)
        return { key, modifiers }
      },
    }),

    viewScreen: tool({
      description:
        "Take a screenshot of the desktop for yourself to look at. Use it to see the screen before " +
        "and after acting on it. The user does not see it.",
      inputSchema: z.object({}),
      execute: async () => screenshot(await getDesktop()),
      toModelOutput: screenshotOutput,
    }),

    showScreen: tool({
      description:
        "Take a screenshot of the desktop and show it to the user in the chat. Use it when the user " +
        "asks to see what's on the screen.",
      inputSchema: z.object({}),
      execute: async () => screenshot(await getDesktop()),
      toModelOutput: screenshotOutput,
    }),
  }
}

// Lets a bot in a group chat pass the request to a teammate. It only names
// the teammate; the client then asks for a turn as them.
export function handoffTool(teammates: { id: string; name: string }[]) {
  return tool({
    description:
      "Hand the person's latest request to a teammate in this group chat whose job fits it better. " +
      "They answer next, in your place, so call this instead of answering and write nothing else.",
    inputSchema: z.object({
      botId: z.string().describe("The teammate's ID."),
      reason: z
        .string()
        .describe(
          "One sentence on why this is the teammate's job, for them to read."
        ),
    }),
    execute: async ({ botId }) => {
      const teammate = teammates.find((t) => t.id === botId)
      if (!teammate) throw new Error(`No teammate has the ID ${botId}.`)
      return { botId: teammate.id, name: teammate.name }
    },
  })
}

// Group chats add handoff to the sandbox tools.
export type ChatTools = ReturnType<typeof sandboxTools> & {
  handoff?: ReturnType<typeof handoffTool>
}

// Assistant messages carry the bot that wrote them, since in group chats
// each turn can be answered by a different bot.
export type ChatUIMessage = UIMessage<
  { botId?: string },
  UIDataTypes,
  InferUITools<Required<ChatTools>>
>
