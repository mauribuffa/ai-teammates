import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";

export const bots = pgTable(
  "bots",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Clerk user ID that owns the bot.
    userId: text("user_id").notNull(),
    name: text().notNull(),
    // Seed for the bot's generated face.
    avatar: text()
      .notNull()
      .$defaultFn(() => nanoid()),
    // What the bot is for, in a phrase.
    job: text().notNull(),
    // How it should go about the job.
    instructions: text(),
    // Sandbox provider ID, created lazily.
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bots_user_id_idx").on(t.userId)],
);

// Fields a user fills in when creating a bot. userId comes from the session.
export const insertBotSchema = createInsertSchema(bots, {
  name: (s) => s.trim().min(1, "Give it a name.").max(50),
  avatar: (s) => s.min(1),
  job: (s) => s.trim().min(1, "Give it a job.").max(80),
  instructions: (s) => s.trim().max(2000),
}).pick({ name: true, avatar: true, job: true, instructions: true });
