"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { SPRING_POP } from "./motion";

export interface EmptyStateProps {
  /** A lucide icon, e.g. <CarTaxiFront size={26} strokeWidth={1.75} />. */
  icon?: ReactNode;
  title: string;
  /** One or two short sentences on what to do next. */
  body?: ReactNode;
  /** Usually a <Button>. */
  action?: ReactNode;
  /** "card" sits in a white rounded card; "plain" sits straight on the page. */
  variant?: "card" | "plain";
  className?: string;
}

/** Friendly placeholder for an empty list, with an optional next step. */
export function EmptyState({ icon, title, body, action, variant = "card", className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex flex-col items-center px-6 py-10 text-center",
        variant === "card" && "rounded-card bg-surface shadow-card",
        className,
      )}
    >
      {icon && (
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SPRING_POP, delay: 0.08 }}
          className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent/25 text-accentDeep"
        >
          {icon}
        </motion.span>
      )}
      <p className="text-lg font-semibold">{title}</p>
      {body != null && <p className="mt-1 max-w-[18rem] text-sm text-ink2">{body}</p>}
      {action != null && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
