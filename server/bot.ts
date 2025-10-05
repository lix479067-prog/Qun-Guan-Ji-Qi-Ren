import { Telegraf, Context } from "telegraf";
import { message } from "telegraf/filters";
import { storage } from "./storage";
import type { BotConfig, Command, WhitelistedGroup } from "@shared/schema";

let bot: Telegraf | null = null;
let botConfig: BotConfig | null = null;

// 缓存配置
const CACHE_TTL = 30 * 60 * 1000; // 30分钟

// 白名单群组缓存：使用 Map 存储，key 为 groupId
const whitelistCache = new Map<string, { data: WhitelistedGroup; expireAt: number }>();

// 命令列表缓存
let commandsCache: { data: Command[]; expireAt: number } | null = null;

// 获取白名单群组（带缓存）
async function getWhitelistedGroup(groupId: string): Promise<WhitelistedGroup | null> {
  const now = Date.now();
  const cached = whitelistCache.get(groupId);
  
  // 检查缓存是否有效
  if (cached && cached.expireAt > now) {
    return cached.data;
  }
  
  // 缓存失效或不存在，从数据库查询
  const group = await storage.getGroupByGroupId(groupId);
  
  // 更新缓存
  if (group) {
    whitelistCache.set(groupId, {
      data: group,
      expireAt: now + CACHE_TTL
    });
  } else {
    // 即使查询结果为 null，也缓存一段时间避免重复查询
    whitelistCache.delete(groupId);
  }
  
  return group;
}

// 获取所有命令（带缓存）
async function getAllCommands(): Promise<Command[]> {
  const now = Date.now();
  
  // 检查缓存是否有效
  if (commandsCache && commandsCache.expireAt > now) {
    return commandsCache.data;
  }
  
  // 缓存失效或不存在，从数据库查询
  const commands = await storage.getAllCommands();
  
  // 更新缓存
  commandsCache = {
    data: commands,
    expireAt: now + CACHE_TTL
  };
  
  return commands;
}

// 清除所有缓存（当配置更新时调用）
export function clearCache(): void {
  whitelistCache.clear();
  commandsCache = null;
  console.log("🔄 Cache cleared");
}

// 辅助函数：发送消息并在指定时间后自动删除
async function sendAndDeleteMessage(
  chatId: number | string, 
  text: string, 
  deleteAfterSeconds: number
): Promise<void> {
  if (!bot) return;
  try {
    const sentMessage = await bot.telegram.sendMessage(chatId, text);
    // 设置定时器删除消息
    setTimeout(async () => {
      try {
        await bot!.telegram.deleteMessage(chatId, sentMessage.message_id);
      } catch (error) {
        // 消息可能已被手动删除或无法删除，忽略错误
        console.log(`Could not delete message ${sentMessage.message_id}:`, error);
      }
    }, deleteAfterSeconds * 1000);
  } catch (error) {
    console.error("Failed to send message:", error);
  }
}

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

  // 监听成员变化事件（入群、退群等）
  bot.on("chat_member", async (ctx) => {
    try {
      const chatId = ctx.chat.id.toString();
      const chatTitle = "title" in ctx.chat ? ctx.chat.title : undefined;
      
      // 检查是否在白名单群组中（使用缓存）
      const whitelistedGroup = await getWhitelistedGroup(chatId);
      if (!whitelistedGroup || !whitelistedGroup.isActive) {
        return;
      }

      const oldStatus = ctx.chatMember.old_chat_member.status;
      const newStatus = ctx.chatMember.new_chat_member.status;
      const inviteLink = ctx.chatMember.invite_link;
      const member = ctx.chatMember.new_chat_member.user;
      const memberName = member.username 
        ? `@${member.username}` 
        : member.first_name;

      // 检测新成员加入（状态从 left/kicked 变为 member/administrator/creator）
      const isJoining = (oldStatus === "left" || oldStatus === "kicked") && 
                        (newStatus === "member" || newStatus === "administrator" || newStatus === "creator");

      // 检测成员退出（状态从 member 变为 left）
      const isLeaving = oldStatus === "member" && newStatus === "left";

      // 检测成员被踢出（状态从 member 变为 kicked）
      const isKicked = oldStatus === "member" && newStatus === "kicked";

      if (isJoining) {
        // 新成员加入
        if (inviteLink) {
          // 通过邀请链接加入
          let creatorInfo = "未知";
          if (inviteLink.name) {
            const match = inviteLink.name.match(/(@\w+)创建/);
            if (match) {
              creatorInfo = match[1];
            }
          } else if (inviteLink.creator) {
            creatorInfo = inviteLink.creator.username 
              ? `@${inviteLink.creator.username}` 
              : inviteLink.creator.first_name;
          }

          // 发送欢迎消息
          await bot!.telegram.sendMessage(
            chatId,
            `🎉 欢迎新成员！\n\n` +
            `👤 ${memberName} 通过 ${creatorInfo} 的邀请链接加入了群组`
          );

          // 记录日志
          await storage.createLog({
            action: "成员加入",
            details: `👥 通过邀请链接加入 | 邀请人: ${creatorInfo}`,
            userName: creatorInfo,
            groupId: chatId,
            groupTitle: chatTitle,
            targetUserName: memberName,
            status: "success",
          });
        } else {
          // 直接加入（如通过群链接、被添加等）
          await storage.createLog({
            action: "成员加入",
            details: `👥 新成员加入群组`,
            userName: undefined,
            groupId: chatId,
            groupTitle: chatTitle,
            targetUserName: memberName,
            status: "success",
          });
        }
      } else if (isLeaving) {
        // 成员主动退出
        await storage.createLog({
          action: "成员退出",
          details: `👋 成员主动退出群组`,
          userName: undefined,
          groupId: chatId,
          groupTitle: chatTitle,
          targetUserName: memberName,
          status: "success",
        });
      } else if (isKicked) {
        // 成员被踢出或封禁
        // ctx.from 是执行操作的管理员
        const operatorName = ctx.from.username 
          ? `@${ctx.from.username}` 
          : ctx.from.first_name;
        
        await storage.createLog({
          action: "成员被移除",
          details: `🚫 成员被移除出群组`,
          userName: operatorName,
          groupId: chatId,
          groupTitle: chatTitle,
          targetUserName: memberName,
          status: "success",
        });
      }
    } catch (error: any) {
      console.error("Chat member event error:", error);
    }
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
              `群组ID: <code>${chatId}</code>\n` +
              `群组名称: ${chatTitle || "未知"}`,
              {
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: '📋 复制群组ID',
                        copy_text: {
                          text: chatId
                        }
                      } as any
                    ]
                  ]
                }
              }
            );
          }
        }
        return;
      }

      const whitelistedGroup = await getWhitelistedGroup(chatId);
      if (!whitelistedGroup || !whitelistedGroup.isActive) {
        return;
      }

      const member = await ctx.getChatMember(ctx.from.id);
      if (member.status !== "creator" && member.status !== "administrator") {
        return;
      }

      const allCommands = await getAllCommands();
      
      let matchingCommand: Command | undefined;
      
      if (hasReply) {
        // 精准匹配：消息必须以指令名开头
        matchingCommand = allCommands.find(
          (cmd) => cmd.isEnabled && cmd.triggerType === 'reply' && messageText.startsWith(cmd.name)
        );
        
        if (matchingCommand) {
          await handleReplyCommand(ctx, matchingCommand);
        }
      } else {
        // 精准匹配：消息必须以指令名开头
        matchingCommand = allCommands.find(
          (cmd) => cmd.isEnabled && cmd.triggerType === 'direct' && messageText.startsWith(cmd.name)
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
    // 启用 chat_member 更新以接收新成员加入通知
    await bot.telegram.setWebhook(webhookUrl, {
      allowed_updates: ["message", "chat_member"]
    });
    console.log(`✅ Webhook configured successfully`);
    console.log(`📝 Bot ID: ${botInfo.id}`);
    console.log(`🎯 Bot username: @${botInfo.username}`);
    console.log(`🔗 Webhook URL: ${webhookUrl}`);
    console.log(`✉️ Messages will be received instantly via webhook`);
    console.log(`👥 Chat member updates enabled for invite link tracking`);
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
        action: command.name,
        details: `📌 置顶消息 | 消息ID: ${replyToMessageId}`,
        userName: `@${ctx.from.username || ctx.from.first_name}`,
        groupId: groupId,
        groupTitle: chatTitle,
        targetUserName: targetUserName,
        status: "success",
      });
      break;

    case "unpin_message":
      try {
        // 执行取消置顶操作
        await ctx.unpinChatMessage(replyToMessageId);
        await ctx.reply("✅ 消息已取消置顶");
        
        // 记录日志（异步，不阻塞）
        storage.createLog({
          action: command.name,
          details: `📌 取消置顶 | 消息ID: ${replyToMessageId}`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: groupId,
          groupTitle: chatTitle,
          targetUserName: targetUserName,
          status: "success",
        }).catch(err => console.error("Log error:", err));
      } catch (error: any) {
        await ctx.reply(`❌ 取消置顶失败: ${error.message}`);
        storage.createLog({
          action: command.name,
          details: `📌 取消置顶失败 | 错误: ${error.message}`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: groupId,
          groupTitle: chatTitle,
          targetUserName: targetUserName,
          status: "error",
        }).catch(err => console.error("Log error:", err));
      }
      break;

    case "set_title":
      if (targetUserId) {
        const titleMatch = messageText.match(/设置头衔\s*(.+)/);
        const customTitle = titleMatch ? titleMatch[1].trim() : "成员";
        
        await ctx.setChatAdministratorCustomTitle(targetUserId, customTitle);
        await ctx.reply(`✅ 头衔已设置为 "${customTitle}"`);
        await storage.createLog({
          action: command.name,
          details: `👤 设置用户头衔 | 头衔内容: "${customTitle}"`,
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
          action: command.name,
          details: `👤 删除用户头衔 | 已清除用户的自定义头衔`,
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
        // 尝试从命令文本中解析禁言时长（分钟）
        const muteMatch = messageText.match(/禁言\s*(\d+)/);
        const muteMinutes = muteMatch ? parseInt(muteMatch[1]) : 60; // 默认60分钟
        const until = Math.floor(Date.now() / 1000) + (muteMinutes * 60);
        
        await ctx.restrictChatMember(targetUserId, {
          permissions: {
            can_send_messages: false,
          },
          until_date: until,
        });
        
        const durationText = muteMinutes >= 60 
          ? `${Math.floor(muteMinutes / 60)}小时${muteMinutes % 60 > 0 ? (muteMinutes % 60) + '分钟' : ''}`
          : `${muteMinutes}分钟`;
        
        await storage.createLog({
          action: command.name,
          details: `🔇 禁言用户 | 禁言时长: ${durationText}`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: groupId,
          groupTitle: chatTitle,
          targetUserName: targetUserName,
          status: "success",
        });
      }
      break;

    case "unmute":
      if (targetUserId) {
        const currentTime = Math.floor(Date.now() / 1000);
        
        await ctx.restrictChatMember(targetUserId, {
          permissions: {
            can_send_messages: true,
            can_send_audios: true,
            can_send_documents: true,
            can_send_photos: true,
            can_send_videos: true,
            can_send_video_notes: true,
            can_send_voice_notes: true,
            can_send_polls: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true,
            can_change_info: false,
            can_invite_users: false,
            can_pin_messages: false,
            can_manage_topics: false,
          },
          until_date: currentTime + 30,
        });
        
        await ctx.reply("✅ 已解除用户禁言");
        
        await storage.createLog({
          action: command.name,
          details: `🔊 解除禁言 | 用户已恢复发言权限`,
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
          action: command.name,
          details: `👢 踢出用户 | 用户已被移出群组`,
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
          action: command.name,
          details: `🚫 封禁用户 | 用户已被永久封禁`,
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
        action: command.name,
        details: `🗑️ 删除消息 | 消息ID: ${replyToMessageId}`,
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
      try {
        // 不传 messageId 参数，取消所有置顶消息（比 unpinAllChatMessages 快）
        await ctx.unpinChatMessage();
        await ctx.reply("✅ 已取消群组所有置顶消息");
        
        // 异步记录日志，不阻塞
        storage.createLog({
          action: command.name,
          details: `📌 取消全部置顶 | 已取消群组所有置顶消息`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: String(ctx.chat.id),
          groupTitle: chatTitle,
          targetUserName: undefined,
          status: "success",
        }).catch(err => console.error("Log error:", err));
      } catch (error: any) {
        await ctx.reply(`❌ 取消所有置顶失败: ${error.message}`);
        storage.createLog({
          action: command.name,
          details: `📌 取消所有置顶失败 | 错误: ${error.message}`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: String(ctx.chat.id),
          groupTitle: chatTitle,
          targetUserName: undefined,
          status: "error",
        }).catch(err => console.error("Log error:", err));
      }
      break;

    case "create_invite_link":
      // 只支持空格分隔格式：/创建邀请 10 5（必须提供参数）
      const linkMatch = messageText.match(/(\d+)\s+(\d+)/);
      
      if (!linkMatch) {
        // 没有提供参数，提示用户正确格式
        await ctx.reply(
          `❌ 请提供人数和时间参数\n\n` +
          `格式：${command.name} 人数 时长(分钟)\n` +
          `示例：${command.name} 10 5\n` +
          `（创建10人5分钟有效的邀请链接）`
        );
        return;
      }
      
      const memberLimit = parseInt(linkMatch[1]);
      const expireMinutes = parseInt(linkMatch[2]);
      const expireDate = Math.floor(Date.now() / 1000) + (expireMinutes * 60);
      
      // 创建人备注
      const creatorName = ctx.from.username || ctx.from.first_name;
      const linkName = `@${creatorName}创建`;
      
      const inviteLink = await ctx.createChatInviteLink({
        member_limit: memberLimit,
        expire_date: expireDate,
        name: linkName,
      });
      
      // 格式化有效期显示
      const expireText = expireMinutes >= 60 
        ? `${Math.floor(expireMinutes / 60)}小时${expireMinutes % 60 > 0 ? (expireMinutes % 60) + '分钟' : ''}`
        : `${expireMinutes}分钟`;
      
      await ctx.reply(
        `✅ 邀请链接已创建\n\n` +
        `🔗 链接：${inviteLink.invite_link}\n` +
        `👥 人数限制：${memberLimit}人\n` +
        `⏰ 有效期：${expireText}\n` +
        `👤 创建人：@${creatorName}`
      );
      
      await storage.createLog({
        action: command.name,
        details: `🔗 创建邀请链接 | 人数: ${memberLimit}人 | 有效期: ${expireText} | 创建人: @${creatorName}`,
        userName: `@${creatorName}`,
        groupId: String(ctx.chat.id),
        groupTitle: chatTitle,
        targetUserName: undefined,
        status: "success",
      });
      break;

    case "set_group_name":
      // 使用动态匹配，支持任意指令名称后跟内容
      const commandNameEscaped = command.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nameMatch = messageText.match(new RegExp(`${commandNameEscaped}\\s+(.+)`));
      const newName = nameMatch ? nameMatch[1].trim() : "";
      
      if (!newName) {
        await ctx.reply(
          `❌ 请提供群组名称\n\n` +
          `格式：${command.name} 新群名\n` +
          `示例：${command.name} 我的超级群组`
        );
        return;
      }
      
      try {
        await ctx.setChatTitle(newName);
        await ctx.reply(`✅ 群组名称已修改为 "${newName}"`);
        storage.createLog({
          action: command.name,
          details: `✏️ 修改群组名称 | 新名称: "${newName}"`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: String(ctx.chat.id),
          groupTitle: chatTitle,
          targetUserName: undefined,
          status: "success",
        }).catch(err => console.error("Log error:", err));
      } catch (error: any) {
        await ctx.reply(`❌ 修改群组名称失败: ${error.message}`);
      }
      break;

    case "set_group_description":
      // 使用动态匹配，支持任意指令名称后跟内容
      const commandDescEscaped = command.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const descMatch = messageText.match(new RegExp(`${commandDescEscaped}\\s+(.+)`));
      const newDesc = descMatch ? descMatch[1].trim() : "";
      
      if (!newDesc) {
        await ctx.reply(
          `❌ 请提供群组简介内容\n\n` +
          `格式：${command.name} 简介内容\n` +
          `示例：${command.name} 这是一个技术交流群`
        );
        return;
      }
      
      try {
        await ctx.setChatDescription(newDesc);
        await ctx.reply(`✅ 群组简介已设置\n\n${newDesc}`);
        storage.createLog({
          action: command.name,
          details: `📝 修改群组简介 | 简介内容: "${newDesc.substring(0, 50)}${newDesc.length > 50 ? '...' : ''}"`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: String(ctx.chat.id),
          groupTitle: chatTitle,
          targetUserName: undefined,
          status: "success",
        }).catch(err => console.error("Log error:", err));
      } catch (error: any) {
        await ctx.reply(`❌ 设置群组简介失败: ${error.message}`);
      }
      break;

    case "delete_group_description":
      try {
        // Telegram API 不能设置完全为空，需要设置一个空格或特殊字符
        await ctx.setChatDescription(" ");
        await ctx.reply("✅ 群组简介已删除");
        storage.createLog({
          action: command.name,
          details: `📝 删除群组简介 | 已清空群组简介内容`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: String(ctx.chat.id),
          groupTitle: chatTitle,
          targetUserName: undefined,
          status: "success",
        }).catch(err => console.error("Log error:", err));
      } catch (error: any) {
        await ctx.reply(`❌ 删除群组简介失败: ${error.message}`);
      }
      break;

    case "unmute":
      // 直接指令方式解除禁言：从消息实体中获取被提及的用户
      let targetUnmuteUserId: number | undefined;
      let targetUnmuteUsername: string | undefined;

      // 从消息实体中查找被提及的用户
      // Telegram 在用户输入 @username 时会自动创建 mention entity
      if (ctx.message.entities) {
        // 查找 text_mention 类型（包含完整用户信息）
        const textMention = ctx.message.entities.find(
          (entity) => entity.type === "text_mention"
        );
        if (textMention && "user" in textMention) {
          targetUnmuteUserId = textMention.user.id;
          targetUnmuteUsername = `@${textMention.user.username || textMention.user.first_name}`;
        }
        
        // 如果没有找到，查找普通 mention 类型
        if (!targetUnmuteUserId) {
          const mention = ctx.message.entities.find(
            (entity) => entity.type === "mention"
          );
          if (mention) {
            // 从消息文本中提取被提及的 username
            const offset = mention.offset;
            const length = mention.length;
            const mentionText = messageText.substring(offset, offset + length);
            const username = mentionText.replace("@", "");
            targetUnmuteUsername = `@${username}`;
            
            // 尝试通过 getChat 获取用户信息
            try {
              const chat = await ctx.telegram.getChat(`@${username}`);
              if (chat.type === "private" && "id" in chat) {
                targetUnmuteUserId = chat.id;
              }
            } catch (error) {
              // 如果获取失败，提示使用回复方式
              await ctx.reply(
                `❌ 无法通过 @${username} 找到用户\n\n` +
                `💡 建议使用回复方式：\n` +
                `1. 找到该用户的任意一条消息\n` +
                `2. 回复该消息\n` +
                `3. 输入解除禁言指令`
              );
              break;
            }
          }
        }
      }

      if (targetUnmuteUserId) {
        const currentTime = Math.floor(Date.now() / 1000);
        
        await ctx.restrictChatMember(targetUnmuteUserId, {
          permissions: {
            can_send_messages: true,
            can_send_audios: true,
            can_send_documents: true,
            can_send_photos: true,
            can_send_videos: true,
            can_send_video_notes: true,
            can_send_voice_notes: true,
            can_send_polls: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true,
            can_change_info: false,
            can_invite_users: false,
            can_pin_messages: false,
            can_manage_topics: false,
          },
          until_date: currentTime + 30,
        });

        await ctx.reply(`✅ 已解除 ${targetUnmuteUsername} 的禁言`);

        await storage.createLog({
          action: command.name,
          details: `🔊 解除禁言 | 用户已恢复发言权限`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: String(ctx.chat.id),
          groupTitle: chatTitle,
          targetUserName: targetUnmuteUsername,
          status: "success",
        });
      } else {
        await ctx.reply(
          `❌ 请使用以下方式之一解除禁言：\n\n` +
          `方式1（推荐）：\n` +
          `• 回复被禁言用户的消息\n` +
          `• 输入解除禁言指令\n\n` +
          `方式2：\n` +
          `• 点击用户头像选择用户\n` +
          `• 在消息中 @ 提及该用户\n` +
          `• 输入解除禁言指令`
        );
      }
      break;

    case "show_admins":
      try {
        // 获取群组管理员列表
        const administrators = await ctx.getChatAdministrators();
        
        // 分类管理员，排除机器人
        const creator = administrators.find(admin => admin.status === "creator" && !admin.user.is_bot);
        const admins = administrators.filter(admin => admin.status === "administrator" && !admin.user.is_bot);
        
        // 构建消息内容
        let message = "群组管理员列表\n\n";
        
        // 显示创建者
        if (creator) {
          const creatorUser = creator.user;
          const creatorName = creatorUser.username 
            ? `@${creatorUser.username}` 
            : creatorUser.first_name;
          const creatorTitle = "custom_title" in creator && creator.custom_title 
            ? ` | 头衔: ${creator.custom_title}` 
            : "";
          message += `创建者：${creatorName}${creatorTitle}\n\n`;
        }
        
        // 显示管理员
        if (admins.length > 0) {
          message += "管理员：\n";
          admins.forEach((admin, index) => {
            const adminUser = admin.user;
            const adminName = adminUser.username 
              ? `@${adminUser.username}` 
              : adminUser.first_name;
            const adminTitle = "custom_title" in admin && admin.custom_title 
              ? ` | 头衔: ${admin.custom_title}` 
              : "";
            message += `${index + 1}. ${adminName}${adminTitle}\n`;
          });
        } else {
          message += "暂无其他管理员\n";
        }
        
        await ctx.reply(message);
        
        // 记录日志
        storage.createLog({
          action: command.name,
          details: `显示管理员列表 | 创建者1人 | 管理员${admins.length}人`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: String(ctx.chat.id),
          groupTitle: chatTitle,
          targetUserName: undefined,
          status: "success",
        }).catch(err => console.error("Log error:", err));
      } catch (error: any) {
        await ctx.reply(`❌ 获取管理员列表失败: ${error.message}`);
        storage.createLog({
          action: command.name,
          details: `获取管理员列表失败 | 错误: ${error.message}`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: String(ctx.chat.id),
          groupTitle: chatTitle,
          targetUserName: undefined,
          status: "error",
        }).catch(err => console.error("Log error:", err));
      }
      break;

    case "show_group_info":
      try {
        // 获取群组完整信息
        const chat = await ctx.getChat();
        
        // 构建消息内容
        let message = "群组信息\n\n";
        
        // 显示群组名称
        if ("title" in chat) {
          message += `群组名称：${chat.title}\n\n`;
        }
        
        // 显示群组简介
        if ("description" in chat && chat.description) {
          message += `群组简介：\n${chat.description}`;
        } else {
          message += `群组简介：暂无简介`;
        }
        
        await ctx.reply(message);
        
        // 记录日志
        storage.createLog({
          action: command.name,
          details: `显示群组信息 | 已发送群组名称和简介`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: String(ctx.chat.id),
          groupTitle: chatTitle,
          targetUserName: undefined,
          status: "success",
        }).catch(err => console.error("Log error:", err));
      } catch (error: any) {
        await ctx.reply(`❌ 获取群组信息失败: ${error.message}`);
        storage.createLog({
          action: command.name,
          details: `获取群组信息失败 | 错误: ${error.message}`,
          userName: `@${ctx.from.username || ctx.from.first_name}`,
          groupId: String(ctx.chat.id),
          groupTitle: chatTitle,
          targetUserName: undefined,
          status: "error",
        }).catch(err => console.error("Log error:", err));
      }
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
