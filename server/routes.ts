import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { hashPassword, verifyPassword, isAuthenticated } from "./auth";
import { startBot, stopBot, getBotStatus } from "./bot";
import { insertGroupWhitelistSchema, insertCommandSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
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

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
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
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token不能为空" });
      }

      // Stop existing bot and start new one
      await stopBot();
      await startBot(token);

      const config = await storage.getBotConfig();
      res.json(config);
    } catch (error: any) {
      console.error("Bot config error:", error);
      res.status(500).json({ message: error.message || "更新机器人配置失败" });
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
