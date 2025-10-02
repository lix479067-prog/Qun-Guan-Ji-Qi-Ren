import { useQuery } from "@tanstack/react-query";
import { CheckCircle, AlertTriangle, FileText, Users } from "lucide-react";
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
        return <CheckCircle className="w-4 h-4 text-accent" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      default:
        return <FileText className="w-4 h-4 text-secondary" />;
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

  // 按群组ID分组日志
  const groupedLogs = logs.reduce((acc, log) => {
    const groupKey = log.groupId || "未知群组";
    if (!acc[groupKey]) {
      acc[groupKey] = {
        groupTitle: log.groupTitle || "未知群组",
        logs: []
      };
    }
    acc[groupKey].logs.push(log);
    return acc;
  }, {} as Record<string, { groupTitle: string; logs: ActivityLog[] }>);

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">群组活动日志</h3>
            <p className="text-sm text-muted-foreground mt-1">管理员指令操作记录（保留10天）</p>
          </div>
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>暂无活动记录</p>
          </div>
        ) : (
          Object.entries(groupedLogs).map(([groupId, { groupTitle, logs: groupLogs }]) => (
            <div key={groupId} className="border-b border-border last:border-b-0">
              {/* 群组标题 */}
              <div className="bg-muted/30 px-4 py-2 sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{groupTitle}</span>
                  <span className="text-xs text-muted-foreground">({groupLogs.length}条记录)</span>
                </div>
              </div>

              {/* 群组日志列表 */}
              <div className="divide-y divide-border/50">
                {groupLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 hover:bg-muted/30 transition-colors"
                    data-testid={`log-item-${log.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${getStatusColor(log.status)}`}>
                        {getStatusIcon(log.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground" data-testid={`text-log-${log.id}-action`}>
                            {log.action}
                          </span>
                          <span className={`px-1.5 py-0.5 text-xs rounded ${getStatusColor(log.status)}`}>
                            {log.status === "success" ? "成功" : "失败"}
                          </span>
                        </div>

                        {/* 操作详情 */}
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          {log.details && (
                            <p>{log.details}</p>
                          )}
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            {log.userName && (
                              <span className="text-primary">{log.userName}</span>
                            )}
                            {log.targetUserName && (
                              <>
                                <span className="text-muted-foreground/60">→</span>
                                <span className="text-orange-400">{log.targetUserName}</span>
                              </>
                            )}
                            <span className="text-muted-foreground/60">·</span>
                            <span>
                              {formatDistanceToNow(new Date(log.timestamp), {
                                addSuffix: true,
                                locale: zhCN,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
