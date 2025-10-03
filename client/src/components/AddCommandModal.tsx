import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertCommandSchema, type InsertCommand, type Command } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCommand?: Command | null;
  existingCommands?: Command[];
}

// 定义操作类型和触发方式的映射关系
const actionTypesByTrigger = {
  reply: [
    { value: "pin_message", label: "置顶消息" },
    { value: "unpin_message", label: "取消置顶消息" },
    { value: "set_title", label: "设置用户头衔" },
    { value: "remove_title", label: "删除用户头衔" },
    { value: "mute", label: "禁言用户" },
    { value: "unmute", label: "解除禁言" },
    { value: "kick", label: "踢出用户" },
    { value: "ban", label: "封禁用户" },
    { value: "delete_message", label: "删除消息" },
  ],
  direct: [
    { value: "unpin_all_messages", label: "取消所有置顶" },
    { value: "create_invite_link", label: "创建邀请链接" },
    { value: "set_group_name", label: "设置群组名称" },
    { value: "set_group_description", label: "设置群组简介" },
    { value: "delete_group_description", label: "删除群组简介" },
    { value: "unmute", label: "解除禁言" },
  ],
} as const;

export default function AddCommandModal({ isOpen, onClose, editingCommand, existingCommands = [] }: AddCommandModalProps) {
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InsertCommand>({
    resolver: zodResolver(insertCommandSchema),
    defaultValues: {
      isEnabled: true,
    },
  });

  useEffect(() => {
    if (!isOpen) return; // modal未打开时不执行
    
    if (editingCommand) {
      setValue("name", editingCommand.name);
      setValue("triggerType", editingCommand.triggerType);
      setValue("actionType", editingCommand.actionType);
      setValue("description", editingCommand.description || "");
      setValue("isEnabled", editingCommand.isEnabled);
    } else {
      // 新建指令时，设置默认值并自动选择第一个可用的操作类型
      reset({ isEnabled: true, triggerType: 'reply' });
      
      // 获取reply触发方式下还未使用的操作类型
      const usedReplyActions = existingCommands
        .filter(cmd => cmd.triggerType === 'reply')
        .map(cmd => cmd.actionType);
      const availableReplyActions = actionTypesByTrigger.reply.filter(
        action => !usedReplyActions.includes(action.value)
      );
      const firstReplyAction = availableReplyActions?.[0]?.value;
      
      if (firstReplyAction) {
        setValue("actionType", firstReplyAction);
      }
    }
  }, [isOpen, editingCommand, setValue, reset, existingCommands]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertCommand) => {
      const res = await apiRequest("POST", "/api/commands", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commands"] });
      toast({
        title: "指令已创建",
      });
      reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "创建失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertCommand) => {
      const res = await apiRequest("PATCH", `/api/commands/${editingCommand?.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commands"] });
      toast({
        title: "指令已更新",
      });
      reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "更新失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertCommand) => {
    if (editingCommand) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isEnabled = watch("isEnabled");
  const triggerType = watch("triggerType");

  // 获取当前触发方式对应的操作类型列表
  // 在新建模式下，过滤掉已经使用的操作类型；编辑模式下显示所有操作类型
  const availableActionTypes = (() => {
    if (!triggerType) return [];
    
    const allActions = actionTypesByTrigger[triggerType as keyof typeof actionTypesByTrigger] || [];
    
    // 编辑模式：显示所有操作类型
    if (editingCommand) {
      return allActions;
    }
    
    // 新建模式：过滤掉已使用的操作类型
    const usedActions = existingCommands
      .filter(cmd => cmd.triggerType === triggerType)
      .map(cmd => cmd.actionType);
    
    return allActions.filter(action => !usedActions.includes(action.value));
  })();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="modal-add-command">
        <DialogHeader>
          <DialogTitle>{editingCommand ? "编辑指令" : "新增自定义指令"}</DialogTitle>
          <DialogDescription>配置机器人响应的群组管理指令</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">指令名称 *</Label>
            <Input
              id="name"
              data-testid="input-command-name"
              placeholder="例如：置顶消息"
              {...register("name")}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="triggerType">触发方式 *</Label>
            <Select
              value={watch("triggerType") || "reply"}
              onValueChange={(value) => {
                setValue("triggerType", value);
                // 当触发方式改变时，自动选择第一个可用的操作类型
                const newTriggerType = value as keyof typeof actionTypesByTrigger;
                const allActions = [...(actionTypesByTrigger[newTriggerType] || [])];
                
                // 在新建模式下，过滤掉已使用的操作类型
                let availableActions = allActions;
                if (!editingCommand) {
                  const usedActions = existingCommands
                    .filter(cmd => cmd.triggerType === value)
                    .map(cmd => cmd.actionType);
                  availableActions = allActions.filter(action => !usedActions.includes(action.value));
                }
                
                const firstAction = availableActions?.[0]?.value;
                if (firstAction) {
                  setValue("actionType", firstAction);
                }
              }}
            >
              <SelectTrigger data-testid="select-trigger-type">
                <SelectValue placeholder="选择触发方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reply">回复指令（管理员回复消息后发送）</SelectItem>
                <SelectItem value="direct">直接指令（管理员直接发送）</SelectItem>
              </SelectContent>
            </Select>
            {errors.triggerType && (
              <p className="text-sm text-destructive">{errors.triggerType.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="actionType">操作类型 *</Label>
            <Select
              value={watch("actionType")}
              onValueChange={(value) => setValue("actionType", value)}
            >
              <SelectTrigger data-testid="select-action-type">
                <SelectValue placeholder="选择操作类型" />
              </SelectTrigger>
              <SelectContent>
                {availableActionTypes.length > 0 ? (
                  availableActionTypes.map((actionType) => (
                    <SelectItem key={actionType.value} value={actionType.value}>
                      {actionType.label}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    请先选择触发方式
                  </div>
                )}
              </SelectContent>
            </Select>
            {errors.actionType && (
              <p className="text-sm text-destructive">{errors.actionType.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">指令描述</Label>
            <Textarea
              id="description"
              data-testid="textarea-command-description"
              rows={3}
              placeholder="简要描述该指令的作用..."
              {...register("description")}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-foreground">启用此指令</p>
              <p className="text-xs text-muted-foreground mt-1">创建后立即在群组中可用</p>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => setValue("isEnabled", checked)}
              data-testid="switch-command-enabled"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="secondary" onClick={onClose} data-testid="button-cancel-command">
              取消
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-command"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "处理中..."
                : editingCommand
                ? "更新指令"
                : "创建指令"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
