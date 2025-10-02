import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddGroupModal from "./AddGroupModal";
import { Plus, Users, RefreshCw, Search } from "lucide-react";
import type { GroupWhitelist } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

export default function GroupWhitelist() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: groups = [] } = useQuery<GroupWhitelist[]>({
    queryKey: ["/api/groups"],
  });

  // 过滤群组：按群组ID或群组名称搜索
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return groups;
    }
    const query = searchQuery.toLowerCase().trim();
    return groups.filter(group => 
      group.groupId.toLowerCase().includes(query) ||
      (group.groupTitle && group.groupTitle.toLowerCase().includes(query))
    );
  }, [groups, searchQuery]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "群组已删除",
        description: "群组已从白名单中移除",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "删除失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/groups/${id}/refresh`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "刷新成功",
        description: "群组信息已更新",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "刷新失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <div className="bg-card border border-border rounded-lg flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">群组白名单</h3>
              <p className="text-sm text-muted-foreground mt-1">授权机器人工作的群组</p>
            </div>
            <Button onClick={() => setShowAddModal(true)} data-testid="button-add-group" className="gap-2">
              <Plus className="w-5 h-5" />
              添加群组
            </Button>
          </div>
          
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="搜索群组ID或名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-group"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto h-[500px]">
          {groups.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无授权群组</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>未找到匹配的群组</p>
              <p className="text-xs mt-1">尝试搜索群组ID或名称</p>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div
                key={group.id}
                className="p-4 border-b border-border hover:bg-muted/50 transition-colors"
                data-testid={`card-group-${group.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground truncate" data-testid={`text-group-${group.id}-title`}>
                        {group.groupTitle || "未命名群组"}
                      </h4>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          group.isActive
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {group.isActive ? "活跃" : "闲置"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">ID: {group.groupId}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {group.memberCount && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {group.memberCount} 成员
                        </span>
                      )}
                      <span>添加于 {new Date(group.addedAt).toLocaleDateString("zh-CN")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => refreshMutation.mutate(group.id)}
                      disabled={refreshMutation.isPending}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid={`button-refresh-group-${group.id}`}
                      title="刷新群组信息"
                    >
                      <RefreshCw className={`w-5 h-5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(group.id)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      data-testid={`button-delete-group-${group.id}`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            {searchQuery.trim() ? (
              <>
                找到 <span className="font-semibold text-foreground">{filteredGroups.length}</span> 个匹配群组 / 共 <span className="font-semibold text-foreground">{groups.length}</span> 个
              </>
            ) : (
              <>
                共 <span className="font-semibold text-foreground">{groups.length}</span> 个授权群组
              </>
            )}
          </p>
        </div>
      </div>

      <AddGroupModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </>
  );
}
