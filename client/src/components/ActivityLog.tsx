import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, AlertTriangle, FileText, Users, RefreshCw, Download, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActivityLog, GroupWhitelist } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function ActivityLogs() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // 获取系统日志（不启用自动刷新）
  const { data: systemLogs = [], refetch: refetchSystemLogs } = useQuery<ActivityLog[]>({
    queryKey: ["/api/logs/system"],
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  // 获取所有群组
  const { data: groups = [], refetch: refetchGroups } = useQuery<GroupWhitelist[]>({
    queryKey: ["/api/groups"],
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  // 获取每个群组的日志（每组最多30条）
  const { data: groupLogsMap = {}, refetch: refetchGroupLogs } = useQuery<Record<string, ActivityLog[]>>({
    queryKey: ["/api/logs/groups", groups.map(g => g.groupId).join(",")],
    enabled: groups.length > 0,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result: Record<string, ActivityLog[]> = {};
      
      // 并行获取所有群组的日志
      await Promise.all(
        groups.map(async (group) => {
          try {
            const response = await fetch(`/api/logs/group/${group.groupId}?limit=30`, {
              credentials: "include",
            });
            if (response.ok) {
              result[group.groupId] = await response.json();
            }
          } catch (error) {
            console.error(`Failed to fetch logs for group ${group.groupId}:`, error);
          }
        })
      );
      
      return result;
    },
  });

  // 设置默认选中的群组
  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].groupId);
    }
  }, [groups, selectedGroupId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchSystemLogs(),
      refetchGroups(),
      refetchGroupLogs(),
    ]);
    setIsRefreshing(false);
  };

  const handleExport = async (groupId: string, days: 2 | 10) => {
    try {
      const response = await fetch(`/api/logs/group/${groupId}/export?days=${days}`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `group_${groupId}_logs_${days}days.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

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

  return (
    <div className="bg-card border border-border rounded-lg">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">活动日志</h3>
            <p className="text-sm text-muted-foreground mt-1">系统日志和群组操作记录（保留10天）</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh-logs"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 左右布局：左侧系统日志，右侧群组日志 */}
      <div className="flex h-[600px]">
        {/* 左侧：系统日志（30%） */}
        <div className="w-[30%] border-r border-border flex flex-col h-full">
          <div className="bg-muted/30 px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">📋 系统日志</span>
              <span className="text-xs text-muted-foreground">({systemLogs.length})</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/50 min-h-0">
            {systemLogs.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">暂无系统日志</p>
              </div>
            ) : (
              systemLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 hover:bg-muted/30 transition-colors"
                  data-testid={`log-system-${log.id}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${getStatusColor(log.status)}`}>
                      {getStatusIcon(log.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground mb-1">
                        {log.action}
                      </div>
                      {log.details && (
                        <p className="text-xs text-muted-foreground mb-1">{log.details}</p>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.timestamp), {
                          addSuffix: true,
                          locale: zhCN,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右侧：群组日志（70%） */}
        <div className="w-[70%] flex flex-col h-full">
          {groups.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>暂无群组白名单</p>
              </div>
            </div>
          ) : (
            <Tabs value={selectedGroupId} onValueChange={setSelectedGroupId} className="flex-1 flex flex-col min-h-0">
              {/* 群组标签页 */}
              <div className="bg-muted/30 px-4 border-b border-border">
                <TabsList className="bg-transparent h-auto p-0 gap-1">
                  {groups.map((group) => {
                    const logCount = groupLogsMap[group.groupId]?.length || 0;
                    return (
                      <TabsTrigger
                        key={group.groupId}
                        value={group.groupId}
                        className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-t-md rounded-b-none px-4 py-2"
                        data-testid={`tab-group-${group.groupId}`}
                      >
                        <Users className="w-3 h-3 mr-1.5" />
                        <span className="text-xs">{group.groupTitle || "未命名群组"}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">({logCount})</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {/* 群组日志内容 */}
              {groups.map((group) => {
                const groupLogs = groupLogsMap[group.groupId] || [];
                
                return (
                  <TabsContent
                    key={group.groupId}
                    value={group.groupId}
                    className="flex-1 m-0 flex flex-col overflow-hidden"
                  >
                    {/* 导出按钮 */}
                    <div className="px-4 py-2 border-b border-border bg-muted/10 flex justify-end gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport(group.groupId, 2)}
                        className="h-7 text-xs"
                        data-testid={`button-export-2days-${group.groupId}`}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        导出2天
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport(group.groupId, 10)}
                        className="h-7 text-xs"
                        data-testid={`button-export-10days-${group.groupId}`}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        导出10天
                      </Button>
                    </div>

                    {/* 日志列表 */}
                    <div className="flex-1 overflow-y-auto divide-y divide-border/50 min-h-0">
                      {groupLogs.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">该群组暂无操作记录</p>
                        </div>
                      ) : (
                        groupLogs.map((log) => (
                          <div
                            key={log.id}
                            className="p-4 hover:bg-muted/30 transition-colors"
                            data-testid={`log-group-${log.id}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${getStatusColor(log.status)}`}>
                                {getStatusIcon(log.status)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <span className="text-sm font-medium text-foreground">
                                    {log.action}
                                  </span>
                                  <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(log.status)}`}>
                                    {log.status === "success" ? "成功" : "失败"}
                                  </span>
                                </div>

                                {log.details && (
                                  <p className="text-sm text-muted-foreground mb-2">{log.details}</p>
                                )}
                                
                                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                                  {log.userName && (
                                    <>
                                      <span className="text-primary font-medium">{log.userName}</span>
                                      {log.targetUserName && <span>→</span>}
                                    </>
                                  )}
                                  {log.targetUserName && (
                                    <span className="text-orange-400 font-medium">{log.targetUserName}</span>
                                  )}
                                  <span>·</span>
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
                        ))
                      )}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
