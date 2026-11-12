"use client";

import type { ReactNode } from "react";

import { Button, Sheet } from "@/components/ui";

export interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy: boolean;
  onConfirm: () => void;
}

/** A small "are you sure" sheet for actions that can't be undone (leave, cancel, reopen). */
export function ConfirmSheet({ open, onClose, title, body, confirmLabel, cancelLabel = "Keep it", busy, onConfirm }: ConfirmSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button variant="soft" size="lg" className="flex-1" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant="danger" size="lg" className="flex-1" loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="pb-5 text-[15px] leading-6 text-ink2">{body}</p>
    </Sheet>
  );
}
