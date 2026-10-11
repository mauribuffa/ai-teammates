import Image from "next/image"
import { Avatar, Style } from "@dicebear/core"
import definition from "@dicebear/styles/gaze.json" with { type: "json" }
import { cn } from "cn"

const style = new Style(definition)

function ChatAvatar({
  seed,
  animated = false,
  className,
}: {
  seed: string
  animated?: boolean
  className?: string
}) {
  const avatar = new Avatar(style, {
    seed,
    tags: animated ? ["animation"] : ["!animation"],
  })

  return (
    <Image
      src={avatar.toDataUri()}
      alt=""
      width={32}
      height={32}
      unoptimized
      className={cn("size-8 shrink-0 rounded-full", className)}
    />
  )
}

// Where each face sits in the square, by how many are shown. Two overlap side
// by side, three form a triangle, four fill a 2x2 grid.
const layouts = [
  [],
  ["inset-0 size-full"],
  ["top-1/2 left-0 size-5/8 -translate-y-1/2", "top-1/2 right-0 size-5/8 -translate-y-1/2"],
  ["top-0 left-1/2 size-11/20 -translate-x-1/2", "bottom-0 left-0 size-11/20", "right-0 bottom-0 size-11/20"],
  ["top-0 left-0 size-1/2", "top-0 right-0 size-1/2", "bottom-0 left-0 size-1/2", "right-0 bottom-0 size-1/2"],
]

// The faces of a chat's bots, taking up the same space as one ChatAvatar.
// Shows up to three; a fourth spot counts the rest.
function GroupAvatar({
  bots,
  className,
}: {
  bots: { avatar: string }[]
  className?: string
}) {
  const shown = bots.slice(0, 3)
  const rest = bots.length - shown.length
  const layout = layouts[shown.length + (rest ? 1 : 0)]

  return (
    <div className={cn("@container relative size-8 shrink-0", className)}>
      {shown.map((bot, i) => (
        <ChatAvatar
          key={i}
          seed={bot.avatar}
          className={cn("absolute", layout[i])}
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-muted text-[length:22cqw] font-medium text-muted-foreground",
            layout[3]
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}

export { ChatAvatar, GroupAvatar }
