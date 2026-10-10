import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const todos = pgTable(
  "todos",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Clerk user ID that owns the todo.
    userId: text("user_id").notNull(),
    title: text().notNull(),
    completed: boolean().notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("todos_user_id_idx").on(t.userId)],
);
