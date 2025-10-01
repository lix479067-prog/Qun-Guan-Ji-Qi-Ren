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
}

export default function AddCommandModal({ isOpen, onClose, editingCommand }: AddCommandModalProps) {
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
    if (editingCommand) {
      setValue("name", editingCommand.name);
      setValue("triggerType", editingCommand.triggerType);
      setValue("actionType", editingCommand.actionType);
      setValue("description", editingCommand.description || "");
      setValue("isEnabled", editingCommand.isEnabled);
    } else {
      reset({ isEnabled: true, triggerType: 'reply' });
    }
  }, [editingCommand, setValue, reset]);

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
              defaultValue={editingCommand?.triggerType || 'reply'}
              onValueChange={(value) => setValue("triggerType", value)}
            >
              <SelectTrigger data-testid="select-trigger-type">
                <SelectValue placeholder="选择触发方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">直接指令（管理员直接发送）</SelectItem>
                <SelectItem value="reply">回复指令（管理员回复消息后发送）</SelectItem>
              </SelectContent>
            </Select>
            {errors.triggerType && (
              <p className="text-sm text-destructive">{errors.triggerType.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="actionType">操作类型 *</Label>
            <Select
              defaultValue={editingCommand?.actionType}
              onValueChange={(value) => setValue("actionType", value)}
            >
              <SelectTrigger data-testid="select-action-type">
                <SelectValue placeholder="选择操作类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pin_message">置顶消息（需回复）</SelectItem>
                <SelectItem value="unpin_message">取消置顶消息（需回复）</SelectItem>
                <SelectItem value="unpin_all_messages">取消所有置顶（直接）</SelectItem>
                <SelectItem value="set_title">设置用户头衔（需回复）</SelectItem>
                <SelectItem value="remove_title">删除用户头衔（需回复）</SelectItem>
                <SelectItem value="mute">禁言用户（需回复）</SelectItem>
                <SelectItem value="kick">踢出用户（需回复）</SelectItem>
                <SelectItem value="delete_message">删除消息（需回复）</SelectItem>
                <SelectItem value="create_invite_link">创建邀请链接（直接）</SelectItem>
                <SelectItem value="set_group_name">设置群组名称（直接）</SelectItem>
                <SelectItem value="set_group_description">设置群组简介（直接）</SelectItem>
                <SelectItem value="delete_group_description">删除群组简介（直接）</SelectItem>
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
