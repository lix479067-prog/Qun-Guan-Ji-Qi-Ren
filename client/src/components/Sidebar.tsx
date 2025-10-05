import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Home, Settings, Users, Terminal, FileText, LogOut } from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "已登出",
        description: "您已成功登出系统",
      });
    },
  });

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo & Brand */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">TG Bot Manager</h1>
            <p className="text-xs text-muted-foreground">群组管理系统</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <Link href="/">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer ${
              location === "/" || location === "/dashboard"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
            data-testid="link-dashboard"
          >
            <Home className="w-5 h-5" />
            <span>仪表盘</span>
          </div>
        </Link>

        <Link href="/group-settings">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer ${
              location === "/group-settings"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
            data-testid="link-group-settings"
          >
            <Settings className="w-5 h-5" />
            <span>群组设置</span>
          </div>
        </Link>

        <Link href="/logs">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer ${
              location === "/logs"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
            data-testid="link-logs"
          >
            <FileText className="w-5 h-5" />
            <span>活动日志</span>
          </div>
        </Link>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
          onClick={() => logoutMutation.mutate()}
          data-testid="button-logout"
        >
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">admin</p>
            <p className="text-xs text-muted-foreground truncate">管理员</p>
          </div>
          <LogOut className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
    </aside>
  );
}
