import { useQuery } from "@tanstack/react-query";
import { CheckCircle, AlertTriangle, RefreshCw, UserPlus, FileText } from "lucide-react";
import type { ActivityLog } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function ActivityLog() {
  const { data: logs = [] } = useQuery<ActivityLog[]>({
    queryKey: ["/api/logs"],
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-accent" />;
      case "error":
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
      default:
        return <FileText className="w-5 h-5 text-secondary" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-accent/10 text-accent";
      case "error":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-secondary/10 text-secondary";
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">最近活动</h3>
            <p className="text-sm text-muted-foreground mt-1">机器人操作和系统事件日志</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border max-h-96 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>暂无活动记录</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors" data-testid={`log-item-${log.id}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getStatusColor(log.status)}`}>
                  {getStatusIcon(log.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground" data-testid={`text-log-${log.id}-action`}>
                      {log.action}
                    </p>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(log.status)}`}>
                      {log.status === "success" ? "成功" : "错误"}
                    </span>
                  </div>
                  {log.details && (
                    <p className="text-xs text-muted-foreground mt-1">{log.details}</p>
                  )}
                  {log.userName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {log.userName} {log.groupTitle && `在 ${log.groupTitle}`} 中执行操作
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(log.timestamp), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
