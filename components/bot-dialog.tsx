"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, ShuffleIcon, Trash2Icon } from "lucide-react"
import { nanoid } from "nanoid"
import { Controller, useForm, useWatch } from "react-hook-form"
import type { z } from "zod"

import { createBot, deleteBot, updateBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
import { insertBotSchema } from "@/db/schema"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"

const presets = [
  {
    job: "Research assistant",
    instructions:
      "Answer briefly, cite sources, and ask before running anything destructive.",
  },
  {
    job: "Code reviewer",
    instructions:
      "Point out bugs first, then readability. Suggest concrete fixes with code.",
  },
  {
    job: "Writing editor",
    instructions:
      "Tighten prose, keep the author's voice, and explain each change in a line.",
  },
  {
    job: "Tutor",
    instructions:
      "Teach step by step, check understanding with questions, and never just hand over answers.",
  },
]

const emptyValues = { name: "", avatar: "", job: "", instructions: "" }

type EditableBot = z.output<typeof insertBotSchema> & { id: string }

// Pass a handle to open the dialog from elsewhere (e.g. a menu item) instead
// of rendering its own trigger button. Pass a bot to edit it instead of
// creating a new one; the trigger then shows its face and name.
function BotDialog({
  handle,
  bot,
}: {
  handle?: DialogPrimitive.Handle<unknown>
  bot?: EditableBot
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const form = useForm({
    resolver: zodResolver(insertBotSchema),
    defaultValues: emptyValues,
  })
  const avatar = useWatch({ control: form.control, name: "avatar" })

  function handleOpenChange(next: boolean) {
    // Start every edit from the saved bot, and every new bot with a blank
    // form and a fresh face.
    if (next) {
      form.reset(
        bot
          ? {
              name: bot.name,
              avatar: bot.avatar,
              job: bot.job,
              instructions: bot.instructions,
            }
          : { ...emptyValues, avatar: nanoid() },
      )
    }
    setOpen(next)
  }

  async function onSubmit(values: z.output<typeof insertBotSchema>) {
    try {
      if (bot) {
        const updated = await updateBot(bot.id, values)
        setOpen(false)
        toast.add({ title: `${updated.name} is updated`, type: "success" })
      } else {
        const created = await createBot(values)
        setOpen(false)
        toast.add({ title: `${created.name} is ready`, type: "success" })
      }
    } catch {
      toast.add({
        title: bot ? "Couldn't update the bot" : "Couldn't create the bot",
        type: "error",
      })
    }
  }

  async function handleDelete() {
    if (!bot) return
    setDeleting(true)
    try {
      const deleted = await deleteBot(bot.id)
      setOpen(false)
      // Its chats are gone, so leave the page that showed one.
      router.push("/")
      toast.add({ title: `${deleted.name} is deleted`, type: "success" })
    } catch {
      toast.add({ title: "Couldn't delete the bot", type: "error" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} handle={handle}>
      {!handle &&
        (bot ? (
          <DialogTrigger
            render={<Button variant="ghost" size="sm" className="-ms-2 min-w-0" />}
          >
            <ChatAvatar seed={bot.avatar} className="size-6" />
            <span className="truncate font-medium">{bot.name}</span>
          </DialogTrigger>
        ) : (
          <DialogTrigger render={<Button variant="secondary" />}>
            <PlusIcon data-icon="inline-start" />
            Create a new bot
          </DialogTrigger>
        ))}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{bot ? "Edit bot" : "New bot"}</DialogTitle>
          <DialogDescription>
            {bot
              ? "Change its face, name, or how it does its job."
              : "Give it a face, a name, and a job to do."}
          </DialogDescription>
        </DialogHeader>
        <form id="bot-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.job}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    form.setValue("job", preset.job, { shouldValidate: true })
                    form.setValue("instructions", preset.instructions)
                  }}
                >
                  {preset.job}
                </Button>
              ))}
            </div>
            <Item className="p-0">
              <ItemMedia>
                <ChatAvatar seed={avatar} className="size-12" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Face</ItemTitle>
                <ItemDescription>
                  Shuffle until you find one you like.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.setValue("avatar", nanoid())}
                >
                  <ShuffleIcon data-icon="inline-start" />
                  Shuffle
                </Button>
              </ItemActions>
            </Item>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="bot-name"
                    placeholder="Ada"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="job"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-job">Job</FieldLabel>
                  <Input
                    {...field}
                    id="bot-job"
                    placeholder="Research assistant"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="instructions"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-instructions">
                    How it should work
                  </FieldLabel>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    id="bot-instructions"
                    placeholder="Answer briefly, cite sources, and ask before running anything destructive."
                    className="min-h-24"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          {bot && (
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button variant="destructive" className="sm:me-auto" />}
              >
                <Trash2Icon data-icon="inline-start" />
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {bot.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This also deletes its chat. It can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={deleting}
                    onClick={handleDelete}
                  >
                    {deleting && <Spinner data-icon="inline-start" />}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="bot-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Spinner data-icon="inline-start" />
            )}
            {bot ? "Save changes" : "Create bot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { BotDialog }
