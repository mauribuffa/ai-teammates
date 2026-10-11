"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import type { z } from "zod"

import { createGroupChat } from "@/actions/chat"
import { ChatAvatar } from "@/components/chat-avatar"
import { insertGroupChatSchema } from "@/db/schema"
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
import type { BotSummary } from "@/queries/chats"

const emptyValues = { name: "", botIds: [] as string[] }

// Opened from elsewhere (e.g. a menu item) through its handle.
function GroupChatDialog({
  handle,
  bots,
}: {
  handle: DialogPrimitive.Handle<unknown>
  bots: BotSummary[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const form = useForm({
    resolver: zodResolver(insertGroupChatSchema),
    defaultValues: emptyValues,
  })

  function handleOpenChange(next: boolean) {
    if (next) form.reset(emptyValues)
    setOpen(next)
  }

  async function onSubmit(values: z.output<typeof insertGroupChatSchema>) {
    try {
      const created = await createGroupChat(values)
      setOpen(false)
      router.push(`/chats/${created.id}`)
      toast.add({ title: `${created.name} is ready`, type: "success" })
    } catch {
      toast.add({ title: "Couldn't create the group", type: "error" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} handle={handle}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New group chat</DialogTitle>
          <DialogDescription>
            Name the group and pick which bots are in it.
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
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { GroupChatDialog }
