import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import AddGroupModal from "./AddGroupModal";
import { Plus, Users, RefreshCw } from "lucide-react";
import type { GroupWhitelist } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

export default function GroupWhitelist() {
  const [showAddModal, setShowAddModal] = useState(false);
  const { toast } = useToast();

  const { data: groups = [] } = useQuery<GroupWhitelist[]>({
    queryKey: ["/api/groups"],
  });

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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">群组白名单</h3>
              <p className="text-sm text-muted-foreground mt-1">授权机器人工作的群组</p>
            </div>
            <Button onClick={() => setShowAddModal(true)} data-testid="button-add-group" className="gap-2">
              <Plus className="w-5 h-5" />
              添加群组
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-96">
          {groups.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无授权群组</p>
            </div>
          ) : (
            groups.map((group) => (
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
            共 <span className="font-semibold text-foreground">{groups.length}</span> 个授权群组
          </p>
        </div>
      </div>

      <AddGroupModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </>
  );
}
