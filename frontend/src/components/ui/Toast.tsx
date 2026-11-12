"use client";

import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

import { useStore } from "@/lib/store";

import { SPRING } from "./motion";

/**
 * The app's single toast, mounted once in the root layout. Slides down from the top.
 * Trigger it with useStore's showToast(text, tone?, action?).
 */
export function Toast() {
  const toast = useStore((s) => s.toast);
  const clear = useStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(clear, toast.action ? 7000 : 3500);
    return () => clearTimeout(id);
  }, [toast, clear]);

  const Icon = toast?.tone === "error" ? CircleAlert : toast?.tone === "success" ? CircleCheck : Info;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto flex max-w-phone justify-center px-4"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      role={toast?.tone === "error" ? "alert" : "status"}
      aria-live={toast?.tone === "error" ? "assertive" : "polite"}
    >
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ y: -64, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -48, opacity: 0, transition: { duration: 0.18 } }}
            transition={SPRING}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.6, bottom: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.y < -24) clear();
            }}
            className="on-dark pointer-events-auto flex min-h-[52px] max-w-full items-center gap-2.5 rounded-full bg-dark py-2 pl-3.5 pr-2 text-sm font-medium text-ondark shadow-float"
          >
            <Icon
              size={20}
              strokeWidth={1.75}
              className={toast.tone === "error" ? "shrink-0 text-warn" : "shrink-0 text-accent"}
              aria-hidden
            />
            <span className="min-w-0 py-1 pr-2">{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className="press h-9 shrink-0 rounded-full bg-accent px-3.5 text-label font-semibold text-accentInk"
                onClick={() => {
                  toast.action?.onClick();
                  clear();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
