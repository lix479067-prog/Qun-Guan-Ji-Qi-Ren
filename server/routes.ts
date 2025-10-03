import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { hashPassword, verifyPassword, isAuthenticated } from "./auth";
import { startBot, stopBot, getBotStatus, getBotInstance, sendGroupActivationNotice } from "./bot";
import { insertGroupWhitelistSchema, insertCommandSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for production deployments (Replit uses proxies)
  app.set('trust proxy', 1);

  // Session setup
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set");
  }

  const isProduction = process.env.NODE_ENV === "production";

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: sessionTtl,
      },
    })
  );

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "用户名和密码不能为空" });
      }

      const admin = await storage.getAdminByUsername(username);
      if (!admin) {
        return res.status(401).json({ message: "用户名或密码错误" });
      }

      const isValid = await verifyPassword(password, admin.password);
      if (!isValid) {
        return res.status(401).json({ message: "用户名或密码错误" });
      }

      (req.session as any).adminId = admin.id;
      res.json({ success: true, admin: { id: admin.id, username: admin.username } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "登录失败" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "登出失败" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", isAuthenticated, async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      const admin = await storage.getAdminByUsername("admin"); // Simplified for demo
      if (!admin) {
        return res.status(404).json({ message: "用户不存在" });
      }
      res.json({ id: admin.id, username: admin.username });
    } catch (error) {
      res.status(500).json({ message: "获取用户信息失败" });
    }
  });

  // Bot config routes
  app.get("/api/bot/config", isAuthenticated, async (req, res) => {
    try {
      const config = await storage.getBotConfig();
      const status = getBotStatus();
      res.json({ config, status });
    } catch (error) {
      res.status(500).json({ message: "获取机器人配置失败" });
    }
  });

  app.post("/api/bot/config", isAuthenticated, async (req, res) => {
    try {
      const { token, clearGroups } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token不能为空" });
      }

      // Stop existing bot and start new one FIRST
      await stopBot();
      await startBot(token);

      // 只有在机器人成功启动后，才清空群组白名单（避免token无效时数据丢失）
      if (clearGroups === true) {
        const groups = await storage.getAllGroups();
        
        // 删除所有群组
        for (const group of groups) {
          await storage.deleteGroup(group.id);
        }
        
        // 同时删除所有群组相关的日志
        const deletedLogsCount = await storage.deleteAllGroupLogs();
        
        await storage.createLog({
          action: "更换机器人Token",
          details: `机器人已更新，已清空 ${groups.length} 个群组白名单，删除 ${deletedLogsCount} 条群组日志`,
          status: "success",
        });
      } else {
        // 保留群组白名单时，向所有白名单群组发送激活通知
        const groups = await storage.getAllGroups();
        const groupIds = groups.map(g => g.groupId);
        
        await storage.createLog({
          action: "更换机器人Token",
          details: `机器人Token已更新，群组白名单已保留 (共${groups.length}个群组)`,
          status: "success",
        });
        
        // 异步发送激活通知，不阻塞响应
        if (groupIds.length > 0) {
          sendGroupActivationNotice(groupIds).catch(error => {
            console.error("发送激活通知失败:", error);
          });
        }
      }

      const config = await storage.getBotConfig();
      res.json(config);
    } catch (error: any) {
      console.error("Bot config error:", error);
      
      await storage.createLog({
        action: "更换机器人Token",
        details: `更新失败: ${error.message}`,
        status: "error",
      });
      
      res.status(500).json({ message: error.message || "更新机器人配置失败" });
    }
  });

  // Telegram webhook endpoint
  app.post("/api/telegram-webhook", async (req, res) => {
    try {
      const bot = getBotInstance();
      if (!bot) {
        return res.status(503).json({ message: "Bot not running" });
      }
      
      await bot.handleUpdate(req.body);
      res.sendStatus(200);
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.sendStatus(500);
    }
  });

  // Group whitelist routes
  app.get("/api/groups", isAuthenticated, async (req, res) => {
    try {
      const groups = await storage.getAllGroups();
      res.json(groups);
    } catch (error) {
      res.status(500).json({ message: "获取群组列表失败" });
    }
  });

  app.post("/api/groups", isAuthenticated, async (req, res) => {
    try {
      const validated = insertGroupWhitelistSchema.parse(req.body);
      const group = await storage.createGroup(validated);
      
      await storage.createLog({
        action: "添加群组到白名单",
        details: `群组 ${group.groupTitle || group.groupId} 已添加`,
        status: "success",
      });

      res.json(group);
    } catch (error: any) {
      console.error("Create group error:", error);
      res.status(400).json({ message: error.message || "添加群组失败" });
    }
  });

  app.delete("/api/groups/:id", isAuthenticated, async (req, res) => {
    try {
      const group = await storage.getGroupById(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "群组不存在" });
      }

      await storage.deleteGroup(req.params.id);
      
      await storage.createLog({
        action: "从白名单移除群组",
        details: `群组 ${group.groupTitle || group.groupId} 已移除`,
        status: "success",
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "删除群组失败" });
    }
  });

  app.post("/api/groups/:id/refresh", isAuthenticated, async (req, res) => {
    try {
      const group = await storage.getGroupById(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "群组不存在" });
      }

      const bot = getBotInstance();
      if (!bot) {
        return res.status(503).json({ message: "机器人未运行" });
      }

      // 通过 Telegram API 获取群组最新信息
      const chat = await bot.telegram.getChat(group.groupId);
      
      // 获取群组成员数
      let memberCount: number | undefined;
      try {
        memberCount = await bot.telegram.getChatMembersCount(group.groupId);
      } catch (error) {
        console.log("无法获取成员数量:", error);
      }

      // 提取群组标题（只有 group/supergroup/channel 有 title）
      const groupTitle = 'title' in chat ? chat.title : group.groupTitle;

      // 更新数据库
      const updatedGroup = await storage.updateGroup(req.params.id, {
        groupTitle: groupTitle || undefined,
        memberCount: memberCount,
      });

      await storage.createLog({
        action: "🔄 刷新群组信息",
        details: `群组 ${updatedGroup.groupTitle || updatedGroup.groupId} 信息已更新`,
        status: "success",
        groupId: undefined,
        groupTitle: undefined,
      });

      res.json(updatedGroup);
    } catch (error: any) {
      console.error("Refresh group error:", error);
      
      await storage.createLog({
        action: "🔄 刷新群组信息",
        details: `刷新失败: ${error.message}`,
        status: "error",
        groupId: undefined,
        groupTitle: undefined,
      });
      
      res.status(500).json({ message: error.message || "刷新群组信息失败" });
    }
  });

  // Command routes
  app.get("/api/commands", isAuthenticated, async (req, res) => {
    try {
      const commands = await storage.getAllCommands();
      res.json(commands);
    } catch (error) {
      res.status(500).json({ message: "获取指令列表失败" });
    }
  });

  app.post("/api/commands", isAuthenticated, async (req, res) => {
    try {
      const validated = insertCommandSchema.parse(req.body);
      const command = await storage.createCommand(validated);
      
      await storage.createLog({
        action: "创建新指令",
        details: `指令 "${command.name}" 已创建`,
        status: "success",
      });

      res.json(command);
    } catch (error: any) {
      console.error("Create command error:", error);
      res.status(400).json({ message: error.message || "创建指令失败" });
    }
  });

  app.patch("/api/commands/:id", isAuthenticated, async (req, res) => {
    try {
      const command = await storage.updateCommand(req.params.id, req.body);
      
      await storage.createLog({
        action: "更新指令配置",
        details: `指令 "${command.name}" 已更新`,
        status: "success",
      });

      res.json(command);
    } catch (error) {
      res.status(500).json({ message: "更新指令失败" });
    }
  });

  app.delete("/api/commands/:id", isAuthenticated, async (req, res) => {
    try {
      const command = await storage.getCommandById(req.params.id);
      if (!command) {
        return res.status(404).json({ message: "指令不存在" });
      }

      await storage.deleteCommand(req.params.id);
      
      await storage.createLog({
        action: "删除指令",
        details: `指令 "${command.name}" 已删除`,
        status: "success",
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "删除指令失败" });
    }
  });

  // Activity logs
  app.get("/api/logs", isAuthenticated, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getRecentLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "获取日志失败" });
    }
  });

  // Get system logs (groupId is null)
  app.get("/api/logs/system", isAuthenticated, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getSystemLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "获取系统日志失败" });
    }
  });

  // Get logs for a specific group
  app.get("/api/logs/group/:groupId", isAuthenticated, async (req, res) => {
    try {
      const { groupId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      const logs = await storage.getGroupLogs(groupId, limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "获取群组日志失败" });
    }
  });

  // Export group logs (2 days or 10 days)
  app.get("/api/logs/group/:groupId/export", isAuthenticated, async (req, res) => {
    try {
      const { groupId } = req.params;
      const days = req.query.days ? parseInt(req.query.days as string) : 2;
      
      // Validate days parameter
      if (days !== 2 && days !== 10) {
        return res.status(400).json({ message: "days参数必须是2或10" });
      }
      
      // Get all logs for this group (no limit)
      const allLogs = await storage.getGroupLogs(groupId, 10000);
      
      // Filter logs by date range
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const filteredLogs = allLogs.filter(log => new Date(log.timestamp) >= cutoffDate);
      
      // Get group info
      const group = await storage.getGroupByGroupId(groupId);
      const groupTitle = group?.groupTitle || groupId;
      
      // Generate CSV content
      const csvHeader = "时间,操作,操作员,目标用户,详情,状态\n";
      const csvRows = filteredLogs.map(log => {
        const timestamp = new Date(log.timestamp).toLocaleString('zh-CN');
        const action = log.action || "";
        const userName = log.userName || "";
        const targetUserName = log.targetUserName || "";
        const details = (log.details || "").replace(/"/g, '""');
        const status = log.status || "";
        return `"${timestamp}","${action}","${userName}","${targetUserName}","${details}","${status}"`;
      }).join("\n");
      
      const csvContent = csvHeader + csvRows;
      
      // Set response headers for file download
      const filename = `${groupTitle}_logs_${days}days_${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      
      // Send CSV with BOM for Excel compatibility
      res.send('\uFEFF' + csvContent);
    } catch (error) {
      console.error("Export logs error:", error);
      res.status(500).json({ message: "导出日志失败" });
    }
  });

  // Statistics
  app.get("/api/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "获取统计数据失败" });
    }
  });

  // Initialize default admin (remove in production)
  (async () => {
    const existingAdmin = await storage.getAdminByUsername("admin");
    if (!existingAdmin) {
      const hashedPassword = await hashPassword("admin123");
      await storage.createAdmin({
        username: "admin",
        password: hashedPassword,
      });
      console.log("Default admin created: admin/admin123");
    }
  })();

  const httpServer = createServer(app);
  return httpServer;
}
