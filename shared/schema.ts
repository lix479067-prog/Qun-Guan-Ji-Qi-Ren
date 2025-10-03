import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Admin users table
export const admins = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
  createdAt: true,
});

export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof admins.$inferSelect;

// Bot configuration table
export const botConfig = pgTable("bot_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull(),
  username: text("username"),
  botId: text("bot_id"),
  isActive: boolean("is_active").default(true).notNull(),
  lastRestart: timestamp("last_restart").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBotConfigSchema = createInsertSchema(botConfig).omit({
  id: true,
  lastRestart: true,
  updatedAt: true,
});

export type InsertBotConfig = z.infer<typeof insertBotConfigSchema>;
export type BotConfig = typeof botConfig.$inferSelect;

// Group whitelist table
export const groupWhitelist = pgTable("group_whitelist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: text("group_id").notNull().unique(),
  groupTitle: text("group_title"),
  memberCount: integer("member_count"),
  isActive: boolean("is_active").default(true).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const insertGroupWhitelistSchema = createInsertSchema(groupWhitelist)
  .omit({
    id: true,
    addedAt: true,
  })
  .extend({
    groupTitle: z.string().optional(),
    memberCount: z.number().optional(),
  });

export type InsertGroupWhitelist = z.infer<typeof insertGroupWhitelistSchema>;
export type GroupWhitelist = typeof groupWhitelist.$inferSelect;

// Commands table
export const commands = pgTable("commands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull().default('reply'), // 'direct' or 'reply'
  actionType: text("action_type").notNull(), // pin_message, unpin_message, unpin_all_messages, set_title, remove_title, mute, kick, ban, delete_message, create_invite_link, set_group_name, set_group_description, delete_group_description, unmute, show_admins
  description: text("description"),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCommandSchema = createInsertSchema(commands).omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCommand = z.infer<typeof insertCommandSchema>;
export type Command = typeof commands.$inferSelect;

// Activity logs table
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(),
  details: text("details"),
  userName: text("user_name"), // 执行操作的管理员
  groupId: text("group_id"), // 群组ID
  groupTitle: text("group_title"), // 群组名称
  targetUserName: text("target_user_name"), // 被操作的用户（如被踢出、被封禁的用户）
  status: text("status").notNull(), // success, error
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("activity_logs_timestamp_idx").on(table.timestamp),
  index("activity_logs_group_id_idx").on(table.groupId),
]);

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
