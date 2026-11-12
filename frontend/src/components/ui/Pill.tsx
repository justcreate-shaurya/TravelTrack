"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { SPRING } from "./motion";

export interface PillProps {
  children: ReactNode;
  /** Selected chips turn solid ink. */
  selected?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  /** "surface" (white chip, for the canvas) or "soft" (grey chip, for inside white cards). */
  tone?: "surface" | "soft";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** A tappable, selectable chip (place filters, flexibility options, quick picks). */
export function Pill({ children, selected = false, onClick, icon, tone = "surface", size = "md", disabled, className, ...rest }: PillProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      whileTap={{ scale: 0.95 }}
      transition={SPRING}
      className={cn(
        "inline-flex shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors duration-200",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "md" ? "h-11 px-4 text-sm" : "h-9 px-3 text-label",
        selected ? "bg-ink text-surface" : tone === "surface" ? "bg-surface text-ink2" : "bg-soft text-ink2",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </motion.button>
  );
}

export type BadgeTone = "neutral" | "accent" | "accentSolid" | "warn" | "danger" | "dark" | "onDark" | "outline";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-soft text-ink2",
  /** Mint tint with readable green text, for light surfaces. */
  accent: "bg-accent/25 text-accentDeep",
  accentSolid: "bg-accent text-accentInk",
  /** The urgency yellow: "1 seat left", "Leaving in 12m". */
  warn: "bg-warn text-warnInk",
  danger: "bg-danger/10 text-danger",
  dark: "bg-ink text-surface",
  /** Translucent chip for dark cards. */
  onDark: "bg-white/10 text-ondark",
  outline: "border border-current bg-transparent",
};

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

/** A small static label (status, vehicle, distance). Not interactive. */
export function Badge({ children, tone = "neutral", icon, size = "md", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "tnum inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-medium",
        size === "md" ? "h-7 px-2.5 text-label" : "h-6 px-2 text-2xs",
        BADGE_TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
