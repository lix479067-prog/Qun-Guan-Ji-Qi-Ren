import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";
import BotConfig from "@/components/BotConfig";
import GroupWhitelist from "@/components/GroupWhitelist";
import CommandConfig from "@/components/CommandConfig";
import ActivityLog from "@/components/ActivityLog";
import { Users, Terminal, CheckCircle, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { data: stats } = useQuery<{
    activeGroups: number;
    configuredCommands: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const { data: botStatus } = useQuery<{
    config: any;
    status: { isRunning: boolean };
  }>({
    queryKey: ["/api/bot/config"],
    // 移除轮询：机器人状态变化很少，不需要每5秒查询
    // 只在页面加载时获取一次即可
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-10">
          <div className="px-8 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">仪表盘</h2>
              <p className="text-sm text-muted-foreground mt-1">Telegram 群组机器人管理系统</p>
            </div>
            <div className="flex items-center gap-4">
              {botStatus?.status?.isRunning && (
                <div className="flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-lg border border-accent/20">
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse-slow"></div>
                  <span className="text-sm font-medium text-accent">机器人运行中</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8 space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatsCard
              title="活跃群组"
              value={stats?.activeGroups || 0}
              change="+3 本周"
              icon={<Users className="w-6 h-6" />}
              trend="up"
            />
            <StatsCard
              title="配置指令"
              value={stats?.configuredCommands || 0}
              change="可用指令"
              icon={<Terminal className="w-6 h-6" />}
            />
            <StatsCard
              title="运行时间"
              value="99.8%"
              change="过去30天"
              icon={<CheckCircle className="w-6 h-6" />}
            />
          </div>

          {/* Bot Configuration */}
          <BotConfig />

          {/* Two Column Layout: Groups & Commands */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GroupWhitelist />
            <CommandConfig />
          </div>

          {/* Activity Log */}
          <ActivityLog />
        </div>
      </main>
    </div>
  );
}
