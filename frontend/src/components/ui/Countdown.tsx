"use client";

import { Clock } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "@/lib/cn";
import { minutesUntil, relative } from "@/lib/time";

export interface CountdownProps {
  /** The moment being counted down to (a pool's window_start). */
  iso: string;
  /** Current time in ms, from useNow(), so every chip on the page ticks together. */
  now: number;
  /** "dark" when placed on a dark card. */
  tone?: "light" | "dark";
  size?: "sm" | "md";
  /** Minutes under which the chip turns yellow and pulses. Default 15. */
  urgentUnder?: number;
  className?: string;
}

/** Text used by the chip: "Leaving in 12m", "in 2h", "Leaving now", "Left 5m ago". */
export function countdownText(iso: string, now: number, urgentUnder = 15): { text: string; urgent: boolean; past: boolean } {
  const mins = minutesUntil(iso, now);
  if (mins < 0) return { text: mins > -1 ? "Leaving now" : `Left ${relative(iso, now)}`, urgent: false, past: true };
  if (mins < 1) return { text: "Leaving now", urgent: true, past: false };
  if (mins < urgentUnder) return { text: `Leaving in ${mins}m`, urgent: true, past: false };
  return { text: relative(iso, now).replace(/^in /, "In "), urgent: false, past: false };
}

/** Time-to-departure chip. Turns warn-yellow and pulses softly under 15 minutes. */
export function Countdown({ iso, now, tone = "light", size = "md", urgentUnder = 15, className }: CountdownProps) {
  const { text, urgent, past } = countdownText(iso, now, urgentUnder);
  return (
    <motion.span
      className={cn(
        "tnum inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-medium",
        size === "md" ? "h-7 px-2.5 text-label" : "h-6 px-2 text-2xs",
        urgent
          ? "bg-warn text-warnInk"
          : tone === "dark"
            ? "bg-white/10 text-ondark"
            : "bg-soft text-ink2",
        past && "opacity-70",
        className,
      )}
      animate={urgent ? { scale: [1, 1.05, 1], opacity: [1, 0.86, 1] } : { scale: 1, opacity: 1 }}
      transition={urgent ? { duration: 1.6, ease: "easeInOut", repeat: Infinity } : { duration: 0.2 }}
    >
      <Clock size={size === "md" ? 14 : 12} strokeWidth={1.75} aria-hidden />
      {text}
    </motion.span>
  );
}
