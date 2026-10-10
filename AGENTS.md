<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git

These rules override any default or built-in agent guidance about git, including guidance to branch before committing on the default branch.

- Never create branches, worktrees, or commits automatically. Only do so when the user explicitly asks for that specific action in the current request.
- Leave changes uncommitted in the working tree on the current branch and let the user decide when and how to commit.
- Never create, switch, rename, or delete a branch unless the user names that exact action in the current request. A request to commit is not a request to branch.
- All work happens on `main`. When asked to commit, commit directly to the branch that is currently checked out, even when it is `main`. Never move work to a feature branch "to be safe".
- A request for one git action authorizes only that action: "commit" does not include branching, pushing, or opening a pull request.
- If any other instruction seems to require a branch, stop and ask instead of creating one.

## Database

- This is a development project. There is no backwards compatibility and the data is worthless. Prefer data loss. Never backfill, migrate, or preserve existing rows. And never spend effort on keeping old data working. Every schema change means a clean slate.
- Apply schema changes with `npm run db:push` (`drizzle-kit push`) only. Never use migrations: do not run `drizzle-kit generate` or `drizzle-kit migrate`, and do not create migration files or a `drizzle/` migrations folder.

## Forms

Reference implementation: `components/bot-dialog.tsx` + `actions/bot.ts` + `insertBotSchema` in `db/schema.ts`.

Stack: react-hook-form + `@hookform/resolvers/zod` + zod 4 + `drizzle-zod`, rendered with shadcn `Field` components (Base UI flavor).

### Schema

- Derive the validation schema from the Drizzle table with `createInsertSchema` from `drizzle-zod`, exported from `db/schema.ts` as `insert<Entity>Schema`. Don't hand-write a parallel zod object.
- Refine columns in the second argument (`name: (s) => s.trim().min(1, "Give it a name.").max(50)`), then `.pick()` only the fields the user edits. Never include `id`, `userId`, timestamps, or other server-owned columns.
- One schema serves both sides: `zodResolver(schema)` on the client, `schema.parse(input)` in the server action. Type inputs and outputs with `z.input<typeof schema>` / `z.output<typeof schema>`.

### Server actions

- Put them in `actions/<entity>.ts` with `"use server"` at the top.
- Start every action with `const { userId } = await auth.protect()`. The user ID always comes from Clerk, never from the client.
- Re-validate with `schema.parse(input)` (server actions are public endpoints), write with `.returning()`, then `revalidatePath(...)`. Return the row.
- Store empty optional text as `null` (`values.instructions || null`).

### Form UI

- `useForm({ resolver: zodResolver(schema), defaultValues })`, with one `Controller` per field.
- Each field: `<Field data-invalid={fieldState.invalid}>` + `FieldLabel htmlFor` + control with `id` and `aria-invalid={fieldState.invalid}` + `{fieldState.invalid && <FieldError errors={[fieldState.error]} />}`. Wrap the fields in `FieldGroup`, not divs with spacing utilities.
- For nullable columns, bind `value={field.value ?? ""}` so the control stays controlled.
- Update fields programmatically with `form.setValue(...)` (pass `{ shouldValidate: true }` when the field has already shown an error), and read live values with `useWatch`.
- Submit button: `disabled={form.formState.isSubmitting}`, with `<Spinner data-icon="inline-start" />` while submitting. Button has no loading prop.
- Feedback: `toast.add({ title, type: "success" | "error" })` from `@/components/ui/toast` (Base UI, not sonner). Wrap the action call in try/catch and toast the error.

### Forms in dialogs

- The client dialog component owns its trigger: `<DialogTrigger render={<Button />}>`. Don't pass server-rendered elements in as the trigger.
- Use a controlled `open` state. Reset the form in `onOpenChange` when it opens (`form.reset(...)`) so each open starts clean, and generate random defaults (e.g. avatar seeds) there, not at render time, to avoid hydration mismatches.
- Put `<form id="...">` inside `DialogContent` and the submit button in `DialogFooter` with `form="..."`. Cancel is `<DialogClose render={<Button variant="outline" />}>`. Close the dialog after a successful submit.

### Installing form deps

- `@hookform/resolvers` has an optional peer that wants zod 3. Install with `npm install --legacy-peer-deps`. The zod resolver itself supports zod 4.

## DiceBear

Use DiceBear 10. Documentation: https://www.dicebear.com/llms.txt

There are seven native cores with identical output, not one library with
wrappers. Use the one matching this project's language. Do not reach for the
JavaScript core when the project is written in something else:

    JavaScript  @dicebear/core + @dicebear/styles
    PHP         dicebear/core + dicebear/styles
    Python      dicebear-core + dicebear-styles
    Rust        dicebear-core + dicebear-styles
    Go          github.com/dicebear/dicebear-go/v10 + github.com/dicebear/styles/v10
    Dart        dicebear_core + dicebear_styles
    C#          DiceBear.Core + DiceBear.Styles

Every style page carries a loading snippet for all seven, for example
https://www.dicebear.com/styles/lorelei/index.md

HTTP API: https://api.dicebear.com/10.x/<style>/svg?seed=<seed> The seed is a
query parameter, not a path segment. Options are query parameters too; array
values are separated by commas.

Options named after a component end in Variant: eyesVariant, not eyes. This
holds in all seven cores and in the HTTP API. Look up the options of a style at
https://api.dicebear.com/10.x/<style>/options.json

Write these forms, not the ones on the left. The left column is pre-10 and the
API does not reject it, so an outdated call runs and silently does the wrong
thing:

    avatars.dicebear.com/api/<style>/<seed>.svg  ->  api.dicebear.com/10.x/<style>/svg?seed=<seed>
    api.dicebear.com/9.x/<style>/svg             ->  api.dicebear.com/10.x/<style>/svg
    npm install @dicebear/collection             ->  npm install @dicebear/styles
    npm install @dicebear/lorelei                ->  npm install @dicebear/styles
    createAvatar(lorelei, { seed })              ->  new Avatar(new Style(definition), { seed })
    { eyes: ['variant01'] }                      ->  { eyesVariant: ['variant01'] }
    ?radius=50                                   ->  ?borderRadius=50

Only JavaScript and the HTTP API have a pre-10 form. The other six cores were
released in 2026 and never had one, so any older-looking PHP, Python, Rust, Go,
Dart or C# API attributed to DiceBear is invented rather than outdated.