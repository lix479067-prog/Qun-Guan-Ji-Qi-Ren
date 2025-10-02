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
        groupId: String(ctx.chat.id),
        groupTitle: "title" in ctx.chat ? ctx.chat.title : undefined,
        targetUserName: undefined,
        status: "error",
      });
    }
  });

  bot.catch((err: any, ctx: Context) => {
    console.error(`⚠️  Bot error for ${ctx.updateType}:`, err);
  });

  // Webhook模式 - 高效、实时、低资源消耗
  // 使用环境变量配置域名（开发和生产环境统一使用）
  const webhookDomain = process.env.WEBHOOK_DOMAIN || process.env.WEBHOOK_URL;
  
  if (!webhookDomain) {
    throw new Error("WEBHOOK_DOMAIN environment variable is required. Please set it to your domain (e.g., your-bot.replit.app or your-custom-domain.com)");
  }
  
  console.log("⏳ Setting up webhook...");
  // 如果域名已包含协议，直接使用；否则添加 https://
  const webhookUrl = webhookDomain.startsWith('http') 
    ? `${webhookDomain}/api/telegram-webhook`
    : `https://${webhookDomain}/api/telegram-webhook`;
  
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`✅ Webhook configured successfully`);
    console.log(`📝 Bot ID: ${botInfo.id}`);
    console.log(`🎯 Bot username: @${botInfo.username}`);
    console.log(`🔗 Webhook URL: ${webhookUrl}`);
    console.log(`✉️ Messages will be received instantly via webhook`);
  } catch (webhookError: any) {
    console.error("❌ Webhook setup failed:", webhookError.message);
    throw webhookError;
  }
}

async function handleReplyCommand(ctx: Context, command: Command): Promise<void> {
  if (!ctx.message || !("text" in ctx.message) || !ctx.message.reply_to_message || !ctx.from || !ctx.chat) {
    return;
  }

  const messageText = ctx.message.text;
  const replyToMessageId = ctx.message.reply_to_message.message_id;
  const targetUserId = ctx.message.reply_to_message.from?.id;
  const targetUser = ctx.message.reply_to_message.from;
  const targetUserName = targetUser ? `@${targetUser.username || targetUser.first_name}` : undefined;
  const chatTitle = "title" in ctx.chat ? ctx.chat.title : undefined;
  const groupId = String(ctx.chat.id);

  switch (command.actionType) {
    case "pin_message":
      await ctx.pinChatMessage(replyToMessageId);
      await storage.createLog({
        action: `执行指令：${command.name}`,
        details: `消息已置顶`,
        userName: `@${ctx.from.username || ctx.from.first_name}`,
        groupId: groupId,
        groupTitle: chatTitle,
        targetUserName: targetUserName,
        status: "success",
      });
      break;

    case "unpin_message":
      await ctx.unpinChatMessage(replyToMessageId);
      await storage.createLog({
        action: `执行指令：${command.name}`,
        details: `消息已取消置顶`,
        userName: `@${ctx.from.username || ctx.from.first_name}`,
        groupId: groupId,
        groupTitle: chatTitle,
        targetUserName: targetUserName,
        status: "success",
      });
      break;

    case "set_title":
      if (targetUserId) {
        const titleMatch = messageText.match(/设置头衔\s*(.+)/);
        const customTitle = titleMatch ? titleMatch[1].trim() : "成员";
        
        await ctx.setChatAdministratorCustomTitle(targetUserId, customTitle);
        await ctx.reply(`✅ 头衔已设置为 "${customTitle}"`);
        await storage.createLog({
          action: `执行指令：${command.name}`,
          details: `用户头衔已设置为 "${customTitle}"`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: groupId,
          groupTitle: chatTitle,
          targetUserName: targetUserName,
          status: "success",
        });
      }
      break;

    case "remove_title":
      if (targetUserId) {
        await ctx.setChatAdministratorCustomTitle(targetUserId, "");
        await ctx.reply("✅ 用户头衔已删除");
        await storage.createLog({
          action: `执行指令：${command.name}`,
          details: `用户头衔已删除`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: groupId,
          groupTitle: chatTitle,
          targetUserName: targetUserName,
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
          groupId: groupId,
          groupTitle: chatTitle,
          targetUserName: targetUserName,
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
          groupId: groupId,
          groupTitle: chatTitle,
          targetUserName: targetUserName,
          status: "success",
        });
      }
      break;

    case "ban":
      if (targetUserId) {
        await ctx.banChatMember(targetUserId);
        await storage.createLog({
          action: `执行指令：${command.name}`,
          details: `用户已被永久封禁`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: groupId,
          groupTitle: chatTitle,
          targetUserName: targetUserName,
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
        groupId: groupId,
        groupTitle: chatTitle,
        targetUserName: targetUserName,
        status: "success",
      });
      break;
  }
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
        groupId: String(ctx.chat.id),
        groupTitle: chatTitle,
        targetUserName: undefined,
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
        groupId: String(ctx.chat.id),
        groupTitle: chatTitle,
        targetUserName: undefined,
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
          groupId: String(ctx.chat.id),
          groupTitle: chatTitle,
          targetUserName: undefined,
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
          groupId: String(ctx.chat.id),
          groupTitle: chatTitle,
          targetUserName: undefined,
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
        groupId: String(ctx.chat.id),
        groupTitle: chatTitle,
        targetUserName: undefined,
        status: "success",
      });
      break;
  }
}

export async function stopBot(): Promise<void> {
  if (bot) {
    try {
      // Webhook模式：删除webhook配置，停止接收消息
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      console.log("🛑 Webhook deleted, bot stopped");
    } catch (error: any) {
      console.error("⚠️  Failed to delete webhook:", error.message);
    }
    bot = null;
    botConfig = null;
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

export async function sendGroupActivationNotice(groupIds: string[]): Promise<void> {
  if (!bot) {
    console.log("⚠️ Bot not running, cannot send activation notice");
    return;
  }

  const successGroups: string[] = [];
  const failedGroups: { groupId: string; error: string }[] = [];

  for (const groupId of groupIds) {
    try {
      await bot.telegram.sendMessage(
        groupId,
        "✅ 机器人已更新并激活成功！\n\n" +
        "⚡️ 所有指令配置保持不变\n" +
        "接下来的管理工作由我来为您完成！"
      );
      successGroups.push(groupId);
      console.log(`✅ Activation notice sent to group ${groupId}`);
    } catch (error: any) {
      failedGroups.push({ groupId, error: error.message });
      console.log(`❌ Failed to send notice to group ${groupId}: ${error.message}`);
    }
  }

  await storage.createLog({
    action: "发送激活通知",
    details: `成功: ${successGroups.length}个群组, 失败: ${failedGroups.length}个群组`,
    status: successGroups.length > 0 ? "success" : "error",
  });
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
