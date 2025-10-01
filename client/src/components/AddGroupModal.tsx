import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertGroupWhitelistSchema, type InsertGroupWhitelist } from "@shared/schema";
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
import { X } from "lucide-react";

interface AddGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddGroupModal({ isOpen, onClose }: AddGroupModalProps) {
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InsertGroupWhitelist>({
    resolver: zodResolver(insertGroupWhitelistSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertGroupWhitelist) => {
      const res = await apiRequest("POST", "/api/groups", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "群组已添加",
        description: "群组已成功添加到白名单",
      });
      reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "添加失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertGroupWhitelist) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent data-testid="modal-add-group">
        <DialogHeader>
          <DialogTitle>添加群组到白名单</DialogTitle>
          <DialogDescription>授权机器人在指定群组工作</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="groupId">群组 ID *</Label>
            <Input
              id="groupId"
              data-testid="input-group-id"
              placeholder="-1001234567890"
              className="font-mono"
              {...register("groupId")}
            />
            {errors.groupId && (
              <p className="text-sm text-destructive">{errors.groupId.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              将机器人添加到群组后，使用 /id 命令获取群组 ID
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupTitle">群组名称（可选）</Label>
            <Input
              id="groupTitle"
              data-testid="input-group-title"
              placeholder="输入群组名称"
              {...register("groupTitle")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="memberCount">成员数量（可选）</Label>
            <Input
              id="memberCount"
              data-testid="input-member-count"
              type="number"
              placeholder="1000"
              {...register("memberCount", { valueAsNumber: true })}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="secondary" onClick={onClose} data-testid="button-cancel-group">
              取消
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-group">
              {createMutation.isPending ? "添加中..." : "添加群组"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
