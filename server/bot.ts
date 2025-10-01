import { Telegraf, Context } from "telegraf";
import { message } from "telegraf/filters";
import { storage } from "./storage";
import type { BotConfig, Command } from "@shared/schema";

let bot: Telegraf | null = null;
let botConfig: BotConfig | null = null;

export async function startBot(token: string): Promise<void> {
  if (bot) {
    await bot.stop();
    bot = null;
  }

  bot = new Telegraf(token);

  const botInfo = await bot.telegram.getMe();
  
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

  await storage.createLog({
    action: "机器人启动",
    details: `Bot @${botInfo.username} 已成功启动`,
    status: "success",
  });

  bot.on(message("text"), async (ctx) => {
    try {
      const chatId = ctx.chat.id.toString();
      const messageText = ctx.message.text;
      const hasReply = !!ctx.message.reply_to_message;

      if (messageText === "/id") {
        const chatType = ctx.chat.type;
        const chatTitle = "title" in ctx.chat ? ctx.chat.title : undefined;
        
        if (chatType === "group" || chatType === "supergroup") {
          const member = await ctx.getChatMember(ctx.from.id);
          if (member.status === "creator" || member.status === "administrator") {
            await ctx.reply(
              `📋 群组信息\n\n` +
              `群组ID: ${chatId}\n` +
              `群组名称: ${chatTitle || "未知"}\n\n` +
              `💡 复制群组ID并在管理面板中添加到白名单即可启用机器人功能。`
            );
          }
        }
        return;
      }

      const whitelistedGroup = await storage.getGroupByGroupId(chatId);
      if (!whitelistedGroup || !whitelistedGroup.isActive) {
        return;
      }

      const member = await ctx.getChatMember(ctx.from.id);
      if (member.status !== "creator" && member.status !== "administrator") {
        return;
      }

      const allCommands = await storage.getAllCommands();
      
      let matchingCommand: Command | undefined;
      
      if (hasReply) {
        matchingCommand = allCommands.find(
          (cmd) => cmd.isEnabled && cmd.triggerType === 'reply' && messageText.includes(cmd.name)
        );
        
        if (matchingCommand) {
          await handleReplyCommand(ctx, matchingCommand);
        }
      } else {
        matchingCommand = allCommands.find(
          (cmd) => cmd.isEnabled && cmd.triggerType === 'direct' && messageText.includes(cmd.name)
        );
        
        if (matchingCommand) {
          await handleDirectCommand(ctx, matchingCommand);
        }
      }
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

  bot.catch((err: any, ctx: Context) => {
    console.error(`⚠️  Bot error for ${ctx.updateType}:`, err);
  });

  const webhookDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG;
  
  if (webhookDomain) {
    console.log("⏳ Setting up webhook (Replit mode)...");
    const webhookUrl = `https://${webhookDomain}/api/telegram-webhook`;
    
    try {
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await bot.telegram.setWebhook(webhookUrl);
      console.log(`✅ Webhook set to: ${webhookUrl}`);
      console.log(`📝 Bot ID: ${botInfo.id}`);
      console.log(`🎯 Bot username: @${botInfo.username}`);
      console.log(`✉️ Bot will receive messages via webhook (instant, more efficient)`);
    } catch (webhookError: any) {
      console.error("❌ Webhook setup failed:", webhookError.message);
      throw webhookError;
    }
  } else {
    console.log("⏳ Using long polling mode...");
    
    try {
      await bot.launch();
      console.log(`✅ Bot @${botInfo.username} started successfully`);
      console.log(`📝 Bot ID: ${botInfo.id}`);
      console.log(`🎯 Bot username: @${botInfo.username}`);
      console.log(`✉️ Bot can now receive messages via long polling`);
    } catch (launchError: any) {
      console.error("❌ bot.launch() failed:", launchError.message);
      throw launchError;
    }
  }
}

async function handleReplyCommand(ctx: Context, command: Command): Promise<void> {
  if (!ctx.message || !("text" in ctx.message) || !ctx.message.reply_to_message || !ctx.from || !ctx.chat) {
    return;
  }

  const messageText = ctx.message.text;
  const replyToMessageId = ctx.message.reply_to_message.message_id;
  const targetUserId = ctx.message.reply_to_message.from?.id;
  const chatTitle = "title" in ctx.chat ? ctx.chat.title : undefined;

  switch (command.actionType) {
    case "pin_message":
      await ctx.pinChatMessage(replyToMessageId);
      await storage.createLog({
        action: `执行指令：${command.name}`,
        details: `消息已置顶`,
        userName: `@${ctx.from.username || ctx.from.first_name}`,
        groupTitle: chatTitle,
        status: "success",
      });
      break;

    case "unpin_message":
      await ctx.unpinChatMessage(replyToMessageId);
      await storage.createLog({
        action: `执行指令：${command.name}`,
        details: `消息已取消置顶`,
        userName: `@${ctx.from.username || ctx.from.first_name}`,
        groupTitle: chatTitle,
        status: "success",
      });
      break;

    case "set_title":
      if (targetUserId) {
        const titleMatch = messageText.match(/设置头衔\s*(.+)/);
        const customTitle = titleMatch ? titleMatch[1].trim() : "成员";
        
        await ctx.setChatAdministratorCustomTitle(targetUserId, customTitle);
        await storage.createLog({
          action: `执行指令：${command.name}`,
          details: `用户头衔已设置为 "${customTitle}"`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupTitle: chatTitle,
          status: "success",
        });
      }
      break;

    case "remove_title":
      if (targetUserId) {
        await ctx.setChatAdministratorCustomTitle(targetUserId, "");
        await storage.createLog({
          action: `执行指令：${command.name}`,
          details: `用户头衔已删除`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupTitle: chatTitle,
          status: "success",
        });
      }
      break;

    case "mute":
      if (targetUserId) {
        const until = Math.floor(Date.now() / 1000) + 3600;
        await ctx.restrictChatMember(targetUserId, {
          permissions: {
            can_send_messages: false,
          },
          until_date: until,
        });
        await storage.createLog({
          action: `执行指令：${command.name}`,
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
        await ctx.unbanChatMember(targetUserId);
        await storage.createLog({
          action: `执行指令：${command.name}`,
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
        action: `执行指令：${command.name}`,
        details: `消息已删除`,
        userName: `@${ctx.from.username || ctx.from.first_name}`,
        groupTitle: chatTitle,
        status: "success",
      });
      break;
  }

  await storage.incrementCommandUsage(command.id);
}

async function handleDirectCommand(ctx: Context, command: Command): Promise<void> {
  if (!ctx.message || !("text" in ctx.message) || !ctx.from || !ctx.chat) {
    return;
  }

  const messageText = ctx.message.text;
  const chatTitle = "title" in ctx.chat ? ctx.chat.title : undefined;

  switch (command.actionType) {
    case "unpin_all_messages":
      await ctx.unpinAllChatMessages();
      await storage.createLog({
        action: `执行指令：${command.name}`,
        details: `所有置顶消息已取消`,
        userName: `@${ctx.from.username || ctx.from.first_name}`,
        groupTitle: chatTitle,
        status: "success",
      });
      break;

    case "create_invite_link":
      const linkMatch = messageText.match(/邀请\s*(\d+)\s*(\d+)/);
      const memberLimit = linkMatch ? parseInt(linkMatch[1]) : 100;
      const expireMinutes = linkMatch ? parseInt(linkMatch[2]) : 60;
      const expireDate = Math.floor(Date.now() / 1000) + (expireMinutes * 60);
      
      const inviteLink = await ctx.createChatInviteLink({
        member_limit: memberLimit,
        expire_date: expireDate,
      });
      
      await ctx.reply(`邀请链接已创建：\n${inviteLink.invite_link}\n人数限制：${memberLimit}\n有效期：${expireMinutes}分钟`);
      
      await storage.createLog({
        action: `执行指令：${command.name}`,
        details: `创建邀请链接，限制${memberLimit}人，有效期${expireMinutes}分钟`,
        userName: `@${ctx.from.username || ctx.from.first_name}`,
        groupTitle: chatTitle,
        status: "success",
      });
      break;

    case "set_group_name":
      const nameMatch = messageText.match(/设置群名\s+(.+)/);
      const newName = nameMatch ? nameMatch[1].trim() : "";
      
      if (newName) {
        await ctx.setChatTitle(newName);
        await storage.createLog({
          action: `执行指令：${command.name}`,
          details: `群组名称已修改为 "${newName}"`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupTitle: chatTitle,
          status: "success",
        });
      }
      break;

    case "set_group_description":
      const descMatch = messageText.match(/设置简介\s+(.+)/);
      const newDesc = descMatch ? descMatch[1].trim() : "";
      
      if (newDesc) {
        await ctx.setChatDescription(newDesc);
        await storage.createLog({
          action: `执行指令：${command.name}`,
          details: `群组简介已修改`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupTitle: chatTitle,
          status: "success",
        });
      }
      break;

    case "delete_group_description":
      await ctx.setChatDescription("");
      await storage.createLog({
        action: `执行指令：${command.name}`,
        details: `群组简介已删除`,
        userName: `@${ctx.from.username || ctx.from.first_name}`,
        groupTitle: chatTitle,
        status: "success",
      });
      break;
  }

  await storage.incrementCommandUsage(command.id);
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

export function getBotInstance(): Telegraf | null {
  return bot;
}

(async () => {
  console.log("🤖 Checking for bot configuration...");
  const config = await storage.getBotConfig();
  console.log("Config found:", config ? "Yes" : "No");
  
  if (config && config.token && config.isActive) {
    console.log("🚀 Starting bot with token:", config.token.substring(0, 10) + "...");
    try {
      await startBot(config.token);
    } catch (error) {
      console.error("❌ Failed to start bot on initialization:", error);
    }
  } else {
    console.log("⚠️  Bot not started: No active config found");
  }
})();
