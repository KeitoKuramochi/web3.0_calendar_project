import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core"

export const profiles = pgTable("profiles", {
  userId:    text("user_id").primaryKey(),
  data:      jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const consultations = pgTable("consultations", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  data:      jsonb("data").notNull(),
  status:    text("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
