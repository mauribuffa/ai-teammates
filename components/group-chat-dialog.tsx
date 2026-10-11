"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2Icon } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import type { z } from "zod"

import {
  createGroupChat,
  deleteGroupChat,
  updateGroupChat,
} from "@/actions/chat"
import { ChatAvatar, GroupAvatar } from "@/components/chat-avatar"
import { insertGroupChatSchema } from "@/db/schema"
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
import { Checkbox } from "@/components/ui/checkbox"
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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import type { BotSummary, ChatDetail } from "@/queries/chats"

const emptyValues = { name: "", botIds: [] as string[] }

// Pass a handle to open the dialog from elsewhere (e.g. a menu item) instead
// of rendering its own trigger button. Pass a chat to edit it instead of
// creating a new one; the trigger then shows its faces and name.
function GroupChatDialog({
  handle,
  chat,
  bots,
}: {
  handle?: DialogPrimitive.Handle<unknown>
  chat?: ChatDetail
  bots: BotSummary[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const form = useForm({
    resolver: zodResolver(insertGroupChatSchema),
    defaultValues: emptyValues,
  })

  function handleOpenChange(next: boolean) {
    // Start every edit from the saved group, and every new group blank.
    if (next) {
      form.reset(
        chat
          ? { name: chat.name ?? "", botIds: chat.bots.map((bot) => bot.id) }
          : emptyValues
      )
    }
    setOpen(next)
  }

  async function onSubmit(values: z.output<typeof insertGroupChatSchema>) {
    try {
      if (chat) {
        const updated = await updateGroupChat(chat.id, values)
        setOpen(false)
        toast.add({ title: `${updated.name} is updated`, type: "success" })
      } else {
        const created = await createGroupChat(values)
        setOpen(false)
        router.push(`/chats/${created.id}`)
        toast.add({ title: `${created.name} is ready`, type: "success" })
      }
    } catch {
      toast.add({
        title: chat ? "Couldn't update the group" : "Couldn't create the group",
        type: "error",
      })
    }
  }

  async function handleDelete() {
    if (!chat) return
    setDeleting(true)
    try {
      const deleted = await deleteGroupChat(chat.id)
      setOpen(false)
      // The chat is gone, so leave its page.
      router.push("/")
      toast.add({ title: `${deleted.name} is deleted`, type: "success" })
    } catch {
      toast.add({ title: "Couldn't delete the group", type: "error" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} handle={handle}>
      {!handle && chat && (
        <DialogTrigger
          render={
            <Button variant="ghost" size="sm" className="-ms-2 min-w-0" />
          }
        >
          <GroupAvatar bots={chat.bots} className="size-6" />
          <span className="truncate font-medium">{chat.name}</span>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {chat ? "Edit group chat" : "New group chat"}
          </DialogTitle>
          <DialogDescription>
            {chat
              ? "Rename the group or change which bots are in it."
              : "Name the group and pick which bots are in it."}
          </DialogDescription>
        </DialogHeader>
        <form id="group-chat-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="group-chat-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="group-chat-name"
                    placeholder="Weekend plans"
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
              name="botIds"
              control={form.control}
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <FieldLegend variant="label">Bots</FieldLegend>
                  <FieldGroup data-slot="checkbox-group" className="gap-3">
                    {bots.map((bot) => (
                      <Field
                        key={bot.id}
                        orientation="horizontal"
                        data-invalid={fieldState.invalid}
                      >
                        <Checkbox
                          id={`group-chat-bot-${bot.id}`}
                          checked={field.value.includes(bot.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, bot.id]
                                : field.value.filter((id) => id !== bot.id)
                            )
                          }
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldLabel
                          htmlFor={`group-chat-bot-${bot.id}`}
                          className="items-center font-normal"
                        >
                          <ChatAvatar seed={bot.avatar} className="size-6" />
                          {bot.name}
                        </FieldLabel>
                      </Field>
                    ))}
                  </FieldGroup>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </FieldSet>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          {chat && (
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button variant="destructive" className="sm:me-auto" />}
              >
                <Trash2Icon data-icon="inline-start" />
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {chat.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Its bots stay, but the group&apos;s messages are gone. It
                    can&apos;t be undone.
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
            form="group-chat-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Spinner data-icon="inline-start" />
            )}
            {chat ? "Save changes" : "Create group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { GroupChatDialog }
