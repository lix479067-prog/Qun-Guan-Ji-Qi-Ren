import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import AddCommandModal from "./AddCommandModal";
import { Plus, Terminal, Edit, Trash2 } from "lucide-react";
import type { Command } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function CommandConfig() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCommand, setEditingCommand] = useState<Command | null>(null);
  const { toast } = useToast();

  const { data: commands = [] } = useQuery<Command[]>({
    queryKey: ["/api/commands"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/commands/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commands"] });
      toast({
        title: "指令已删除",
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

  const getActionTypeColor = (actionType: string) => {
    switch (actionType) {
      case "pin_message":
        return "bg-primary/10 text-primary";
      case "set_title":
        return "bg-accent/10 text-accent";
      case "mute":
        return "bg-secondary/10 text-secondary";
      case "kick":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <>
      <div className="bg-card border border-border rounded-lg flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">指令配置</h3>
              <p className="text-sm text-muted-foreground mt-1">自定义机器人响应指令</p>
            </div>
            <Button
              onClick={() => {
                setEditingCommand(null);
                setShowAddModal(true);
              }}
              data-testid="button-add-command"
              className="gap-2"
            >
              <Plus className="w-5 h-5" />
              新增指令
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto h-[500px]">
          {commands.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Terminal className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无配置指令</p>
            </div>
          ) : (
            commands.map((command) => (
              <div
                key={command.id}
                className="p-4 border-b border-border hover:bg-muted/50 transition-colors"
                data-testid={`card-command-${command.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-1 text-xs font-mono rounded ${getActionTypeColor(command.actionType)}`}>
                        {command.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          command.triggerType === 'direct'
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-purple-500/10 text-purple-500"
                        }`}
                      >
                        {command.triggerType === 'direct' ? "直接指令" : "回复指令"}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          command.isEnabled
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {command.isEnabled ? "已启用" : "已禁用"}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mt-2" data-testid={`text-command-${command.id}-description`}>
                      {command.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingCommand(command);
                        setShowAddModal(true);
                      }}
                      className="p-2 text-secondary hover:bg-secondary/10 rounded-lg transition-colors"
                      data-testid={`button-edit-command-${command.id}`}
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(command.id)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      data-testid={`button-delete-command-${command.id}`}
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
            共 <span className="font-semibold text-foreground">{commands.length}</span> 个配置指令
          </p>
        </div>
      </div>

      <AddCommandModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingCommand(null);
        }}
        editingCommand={editingCommand}
      />
    </>
  );
}
