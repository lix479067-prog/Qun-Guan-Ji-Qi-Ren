import { Telegraf, Context } from "telegraf";
import { message } from "telegraf/filters";
import { storage } from "./storage";
import type { BotConfig } from "@shared/schema";

let bot: Telegraf | null = null;
let botConfig: BotConfig | null = null;

export async function startBot(token: string): Promise<void> {
  if (bot) {
    await bot.stop();
    bot = null;
  }

  bot = new Telegraf(token);

  // Fetch bot info
  const botInfo = await bot.telegram.getMe();
  
  // Update bot config in database
  const config = await storage.getBotConfig();
  if (config) {
    botConfig = await storage.updateBotConfig({
      id: config.id,
      token,
      username: botInfo.username,
      botId: botInfo.id.toString(),
      lastRestart: new Date(),
      isActive: true,
    });
  } else {
    botConfig = await storage.createBotConfig({
      token,
      username: botInfo.username,
      botId: botInfo.id.toString(),
      isActive: true,
    });
  }

  // Log bot start
  await storage.createLog({
    action: "机器人启动",
    details: `Bot @${botInfo.username} 已成功启动`,
    status: "success",
  });

  // Listen for messages with replies (commands)
  bot.on(message("text"), async (ctx) => {
    try {
      // Check if message is a reply
      if (!ctx.message.reply_to_message) {
        return;
      }

      const chatId = ctx.chat.id.toString();
      const messageText = ctx.message.text;

      // Check if chat is whitelisted
      const whitelistedGroup = await storage.getGroupByGroupId(chatId);
      if (!whitelistedGroup || !whitelistedGroup.isActive) {
        return;
      }

      // Check if sender is admin
      const member = await ctx.getChatMember(ctx.from.id);
      if (member.status !== "creator" && member.status !== "administrator") {
        return;
      }

      // Find matching command
      const allCommands = await storage.getAllCommands();
      const matchingCommand = allCommands.find(
        (cmd) => cmd.isEnabled && messageText.includes(cmd.name)
      );

      if (!matchingCommand) {
        return;
      }

      const replyToMessageId = ctx.message.reply_to_message.message_id;
      const targetUserId = ctx.message.reply_to_message.from?.id;
      const chatTitle = "title" in ctx.chat ? ctx.chat.title : undefined;

      // Execute command based on action type
      switch (matchingCommand.actionType) {
        case "pin_message":
          await ctx.pinChatMessage(replyToMessageId);
          await storage.createLog({
            action: `执行指令：${matchingCommand.name}`,
            details: `消息已置顶`,
            userName: `@${ctx.from.username || ctx.from.first_name}`,
            groupTitle: chatTitle,
            status: "success",
          });
          break;

        case "set_title":
          if (targetUserId) {
            // Extract title from command text
            const titleMatch = messageText.match(/更改头衔为(.+)/);
            const customTitle = titleMatch ? titleMatch[1].trim() : "成员";
            
            await ctx.setChatAdministratorCustomTitle(targetUserId, customTitle);
            await storage.createLog({
              action: `执行指令：${matchingCommand.name}`,
              details: `用户头衔已设置为 "${customTitle}"`,
              userName: `@${ctx.from.username || ctx.from.first_name}`,
              groupTitle: chatTitle,
              status: "success",
            });
          }
          break;

        case "mute":
          if (targetUserId) {
            const until = Math.floor(Date.now() / 1000) + 3600; // 1 hour
            await ctx.restrictChatMember(targetUserId, {
              permissions: {
                can_send_messages: false,
              },
              until_date: until,
            });
            await storage.createLog({
              action: `执行指令：${matchingCommand.name}`,
              details: `用户已被禁言1小时`,
              userName: `@${ctx.from.username || ctx.from.first_name}`,
              groupTitle: chatTitle,
              status: "success",
            });
          }
          break;

        case "kick":
          if (targetUserId) {
            await ctx.banChatMember(targetUserId);
            await ctx.unbanChatMember(targetUserId); // Unban to allow rejoin
            await storage.createLog({
              action: `执行指令：${matchingCommand.name}`,
              details: `用户已被踢出群组`,
              userName: `@${ctx.from.username || ctx.from.first_name}`,
              groupTitle: chatTitle,
              status: "success",
            });
          }
          break;

        case "delete_message":
          await ctx.deleteMessage(replyToMessageId);
          await storage.createLog({
            action: `执行指令：${matchingCommand.name}`,
            details: `消息已删除`,
            userName: `@${ctx.from.username || ctx.from.first_name}`,
            groupTitle: chatTitle,
            status: "success",
          });
          break;
      }

      // Increment command usage count
      await storage.incrementCommandUsage(matchingCommand.id);
    } catch (error: any) {
      console.error("Bot error:", error);
      await storage.createLog({
        action: "指令执行失败",
        details: error.message || "未知错误",
        userName: ctx.from?.username ? `@${ctx.from.username}` : undefined,
        groupTitle: "title" in ctx.chat ? ctx.chat.title : undefined,
        status: "error",
      });
    }
  });

  await bot.launch();
  console.log(`Bot @${botInfo.username} started successfully`);
}

export async function stopBot(): Promise<void> {
  if (bot) {
    await bot.stop();
    bot = null;
  }
}

export function getBotStatus(): { isRunning: boolean; config: BotConfig | null } {
  return {
    isRunning: bot !== null,
    config: botConfig,
  };
}

// Initialize bot on server start if token exists
(async () => {
  const config = await storage.getBotConfig();
  if (config && config.token && config.isActive) {
    try {
      await startBot(config.token);
    } catch (error) {
      console.error("Failed to start bot on initialization:", error);
    }
  }
})();
