import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // 定时清理10天前的日志（每天凌晨3点执行）
  const scheduleLogCleanup = () => {
    const now = new Date();
    const next3AM = new Date(now);
    next3AM.setHours(3, 0, 0, 0);
    
    if (now > next3AM) {
      next3AM.setDate(next3AM.getDate() + 1);
    }
    
    const msUntil3AM = next3AM.getTime() - now.getTime();
    
    setTimeout(async () => {
      try {
        const deletedCount = await storage.cleanOldLogs(10);
        log(`🗑️  自动清理完成：删除了 ${deletedCount} 条10天前的日志`);
      } catch (error) {
        console.error("日志清理失败:", error);
      }
      
      // 安排下一次执行（24小时后）
      setInterval(async () => {
        try {
          const deletedCount = await storage.cleanOldLogs(10);
          log(`🗑️  自动清理完成：删除了 ${deletedCount} 条10天前的日志`);
        } catch (error) {
          console.error("日志清理失败:", error);
        }
      }, 24 * 60 * 60 * 1000);
    }, msUntil3AM);
    
    log(`⏰ 日志自动清理任务已设置：下次执行时间 ${next3AM.toLocaleString('zh-CN')}`);
  };
  
  scheduleLogCleanup();
})();
