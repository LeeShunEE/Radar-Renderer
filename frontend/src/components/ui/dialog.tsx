"use client";

import React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  danger = false,
  onConfirm,
}) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Positioner className="fixed inset-0 z-50 flex items-center justify-center">
          <Dialog.Popup className="bg-card border border-unfocused-border-color rounded-lg shadow-lg p-4 max-w-sm w-full space-y-4">
            <Dialog.Title className="text-sm font-semibold">
              {title}
            </Dialog.Title>
            <Dialog.Description className="text-xs text-muted-foreground">
              {description}
            </Dialog.Description>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                {cancelLabel}
              </Button>
              <Button
                variant={danger ? "destructive" : "default"}
                size="sm"
                onClick={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
              >
                {confirmLabel}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Positioner>
      </Dialog.Portal>
    </Dialog.Root>
  );
};