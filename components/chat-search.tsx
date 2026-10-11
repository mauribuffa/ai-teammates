"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"

import { GroupAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { useSidebar } from "@/components/ui/sidebar"
import type { Chat } from "@/queries/chats"

export function ChatSearch({ chats }: { chats: Chat[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { state, isMobile } = useSidebar()
  // The mobile sheet is always expanded, whatever the desktop state.
  const collapsed = state === "collapsed" && !isMobile

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      {collapsed ? (
        // Matches the other icon buttons of the collapsed sidebar.
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          onClick={() => setOpen(true)}
        >
          <SearchIcon />
        </Button>
      ) : (
        // Looks like the Input (its default classes), keeps the outline hover.
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="h-8 w-full min-w-0 justify-start rounded-lg border-input bg-transparent px-2.5 py-1 text-base font-normal text-muted-foreground md:text-sm dark:bg-input/30"
        >
          <SearchIcon />
          Search
          <Kbd className="ms-auto">⌘K</Kbd>
        </Button>
      )}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search chats"
        description="Search your chats by name."
      >
        <Command>
          <CommandInput placeholder="Search chats..." />
          <CommandList>
            <CommandEmpty>No chats found.</CommandEmpty>
            <CommandGroup heading="Chats">
              {chats.map((chat) => {
                const name = chat.name ?? chat.bots[0].name
                return (
                  <CommandItem
                    key={chat.id}
                    value={name}
                    onSelect={() => {
                      setOpen(false)
                      router.push(`/chats/${chat.id}`)
                    }}
                  >
                    <GroupAvatar bots={chat.bots} className="size-6" />
                    <span className="truncate">{name}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
