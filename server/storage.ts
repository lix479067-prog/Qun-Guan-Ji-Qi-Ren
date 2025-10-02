import {
  admins,
  botConfig,
  groupWhitelist,
  commands,
  activityLogs,
  type Admin,
  type InsertAdmin,
  type BotConfig,
  type InsertBotConfig,
  type GroupWhitelist,
  type InsertGroupWhitelist,
  type Command,
  type InsertCommand,
  type ActivityLog,
  type InsertActivityLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Admin operations
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;

  // Bot config operations
  getBotConfig(): Promise<BotConfig | undefined>;
  updateBotConfig(config: Partial<InsertBotConfig> & { id: string }): Promise<BotConfig>;
  createBotConfig(config: InsertBotConfig): Promise<BotConfig>;

  // Group whitelist operations
  getAllGroups(): Promise<GroupWhitelist[]>;
  getGroupById(id: string): Promise<GroupWhitelist | undefined>;
  getGroupByGroupId(groupId: string): Promise<GroupWhitelist | undefined>;
  createGroup(group: InsertGroupWhitelist): Promise<GroupWhitelist>;
  deleteGroup(id: string): Promise<void>;
  updateGroup(id: string, updates: Partial<InsertGroupWhitelist>): Promise<GroupWhitelist>;

  // Command operations
  getAllCommands(): Promise<Command[]>;
  getCommandById(id: string): Promise<Command | undefined>;
  getCommandByName(name: string): Promise<Command | undefined>;
  createCommand(command: InsertCommand): Promise<Command>;
  updateCommand(id: string, updates: Partial<InsertCommand>): Promise<Command>;
  deleteCommand(id: string): Promise<void>;
  incrementCommandUsage(id: string): Promise<void>;

  // Activity log operations
  getRecentLogs(limit?: number): Promise<ActivityLog[]>;
  createLog(log: InsertActivityLog): Promise<ActivityLog>;
  cleanOldLogs(daysToKeep?: number): Promise<number>;

  // Statistics
  getStats(): Promise<{
    activeGroups: number;
    commandsExecuted: number;
    configuredCommands: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Admin operations
  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.username, username));
    return admin || undefined;
  }

  async createAdmin(insertAdmin: InsertAdmin): Promise<Admin> {
    const [admin] = await db.insert(admins).values(insertAdmin).returning();
    return admin;
  }

  // Bot config operations
  async getBotConfig(): Promise<BotConfig | undefined> {
    const [config] = await db.select().from(botConfig).limit(1);
    return config || undefined;
  }

  async updateBotConfig(config: Partial<InsertBotConfig> & { id: string; lastRestart?: Date }): Promise<BotConfig> {
    const { id, ...updates } = config;
    const [updated] = await db
      .update(botConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(botConfig.id, id))
      .returning();
    return updated;
  }

  async createBotConfig(config: InsertBotConfig): Promise<BotConfig> {
    const [created] = await db.insert(botConfig).values(config).returning();
    return created;
  }

  // Group whitelist operations
  async getAllGroups(): Promise<GroupWhitelist[]> {
    return await db.select().from(groupWhitelist).orderBy(desc(groupWhitelist.addedAt));
  }

  async getGroupById(id: string): Promise<GroupWhitelist | undefined> {
    const [group] = await db.select().from(groupWhitelist).where(eq(groupWhitelist.id, id));
    return group || undefined;
  }

  async getGroupByGroupId(groupId: string): Promise<GroupWhitelist | undefined> {
    const [group] = await db.select().from(groupWhitelist).where(eq(groupWhitelist.groupId, groupId));
    return group || undefined;
  }

  async createGroup(group: InsertGroupWhitelist): Promise<GroupWhitelist> {
    const [created] = await db.insert(groupWhitelist).values(group).returning();
    return created;
  }

  async deleteGroup(id: string): Promise<void> {
    await db.delete(groupWhitelist).where(eq(groupWhitelist.id, id));
  }

  async updateGroup(id: string, updates: Partial<InsertGroupWhitelist>): Promise<GroupWhitelist> {
    const [updated] = await db
      .update(groupWhitelist)
      .set(updates)
      .where(eq(groupWhitelist.id, id))
      .returning();
    return updated;
  }

  // Command operations
  async getAllCommands(): Promise<Command[]> {
    return await db.select().from(commands).orderBy(desc(commands.createdAt));
  }

  async getCommandById(id: string): Promise<Command | undefined> {
    const [command] = await db.select().from(commands).where(eq(commands.id, id));
    return command || undefined;
  }

  async getCommandByName(name: string): Promise<Command | undefined> {
    const [command] = await db.select().from(commands).where(eq(commands.name, name));
    return command || undefined;
  }

  async createCommand(command: InsertCommand): Promise<Command> {
    const [created] = await db.insert(commands).values(command).returning();
    return created;
  }

  async updateCommand(id: string, updates: Partial<InsertCommand>): Promise<Command> {
    const [updated] = await db
      .update(commands)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(commands.id, id))
      .returning();
    return updated;
  }

  async deleteCommand(id: string): Promise<void> {
    await db.delete(commands).where(eq(commands.id, id));
  }

  async incrementCommandUsage(id: string): Promise<void> {
    await db
      .update(commands)
      .set({ usageCount: sql`${commands.usageCount} + 1` })
      .where(eq(commands.id, id));
  }

  // Activity log operations
  async getRecentLogs(limit: number = 50): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.timestamp))
      .limit(limit);
  }

  async createLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db.insert(activityLogs).values(log).returning();
    return created;
  }

  async cleanOldLogs(daysToKeep: number = 10): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const deleted = await db
      .delete(activityLogs)
      .where(sql`${activityLogs.timestamp} < ${cutoffDate}`)
      .returning();
    
    return deleted.length;
  }

  // Statistics
  async getStats(): Promise<{
    activeGroups: number;
    commandsExecuted: number;
    configuredCommands: number;
  }> {
    const groups = await db.select().from(groupWhitelist).where(eq(groupWhitelist.isActive, true));
    const cmds = await db.select().from(commands);
    const totalUsage = cmds.reduce((sum, cmd) => sum + cmd.usageCount, 0);

    return {
      activeGroups: groups.length,
      commandsExecuted: totalUsage,
      configuredCommands: cmds.length,
    };
  }
}

export const storage = new DatabaseStorage();
