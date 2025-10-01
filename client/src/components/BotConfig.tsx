import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, User, Tag, Zap, Clock, BarChart3 } from "lucide-react";

export default function BotConfig() {
  const { toast } = useToast();
  const [showToken, setShowToken] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  const { data: botData } = useQuery<{
    config: any;
    status: { isRunning: boolean };
  }>({
    queryKey: ["/api/bot/config"],
  });

  const updateTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest("POST", "/api/bot/config", { token });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bot/config"] });
      toast({
        title: "Token 已更新",
        description: "机器人已成功重启",
      });
      setTokenInput("");
    },
    onError: (error: Error) => {
      toast({
        title: "更新失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdateToken = () => {
    if (!tokenInput.trim()) {
      toast({
        title: "Token 不能为空",
        variant: "destructive",
      });
      return;
    }
    updateTokenMutation.mutate(tokenInput);
  };

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">机器人配置</h3>
            <p className="text-sm text-muted-foreground mt-1">管理和更新 Telegram Bot Token</p>
          </div>
          <Button
            onClick={handleUpdateToken}
            disabled={updateTokenMutation.isPending}
            data-testid="button-update-token"
            className="gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            更新Token
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Current Bot Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Label className="text-sm font-medium text-foreground mb-2">机器人用户名</Label>
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 rounded-lg border border-border">
              <User className="w-5 h-5 text-primary" />
              <span className="font-mono text-foreground" data-testid="text-bot-username">
                @{botData?.config?.username || "未配置"}
              </span>
              {botData?.status?.isRunning && (
                <span className="ml-auto px-2 py-1 bg-accent text-accent-foreground text-xs rounded-full">
                  活跃
                </span>
              )}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground mb-2">机器人ID</Label>
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 rounded-lg border border-border">
              <Tag className="w-5 h-5 text-secondary" />
              <span className="font-mono text-foreground" data-testid="text-bot-id">
                {botData?.config?.botId || "未配置"}
              </span>
            </div>
          </div>
        </div>

        {/* Bot Token */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-2">Bot Token</Label>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              value={tokenInput || botData?.config?.token || ""}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="输入新的 Bot Token"
              className="font-mono text-sm pr-24"
              data-testid="input-bot-token"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
            >
              {showToken ? "隐藏" : "显示"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            从 @BotFather 获取 Token 后更新，机器人将自动重启
          </p>
        </div>

        {/* Bot Status Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">最后重启</p>
              <p className="text-sm font-medium text-foreground" data-testid="text-last-restart">
                {botData?.config?.lastRestart
                  ? new Date(botData.config.lastRestart).toLocaleString("zh-CN")
                  : "未知"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">运行状态</p>
              <p className="text-sm font-medium text-foreground" data-testid="text-bot-status">
                {botData?.status?.isRunning ? "运行中" : "已停止"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">API版本</p>
              <p className="text-sm font-medium text-foreground">Bot API 7.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
