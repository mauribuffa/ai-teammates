import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
