"use client";

import { motion } from "motion/react";
import { useEffect, useId, useMemo, useRef } from "react";

import { cn } from "@/lib/cn";
import { nextDays } from "@/lib/time";

import { SPRING } from "./motion";

export interface DateStripProps {
  /** Selected day as YYYY-MM-DD (IST), or null for none. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Tapping the selected day again clears it (board filter). Leave false where a day is required (create wizard). */
  allowNone?: boolean;
  /** How many days to show, starting today. Default 7. */
  days?: number;
  /** "canvas": unselected days are translucent (home screen). "soft": unselected days are grey tiles (inside a white sheet). */
  tone?: "canvas" | "soft";
  /** Accessible name. */
  label?: string;
  className?: string;
}

/**
 * Horizontally scrolling day picker. The selected day is a raised white card with an
 * accent bar that slides between days. Bleeds to the screen edge inside a px-5 container.
 */
export function DateStrip({ value, onChange, allowNone = false, days = 7, tone = "canvas", label = "Day", className }: DateStripProps) {
  const id = useId();
  const list = useMemo(() => nextDays(days), [days]);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [value]);

  return (
    <div role="group" aria-label={label} className={cn("rail py-1", className)}>
      {list.map((d) => {
        const active = d.key === value;
        return (
          <motion.button
            key={d.key}
            ref={active ? selectedRef : undefined}
            type="button"
            aria-pressed={active}
            aria-label={`${d.isToday ? "Today, " : ""}${d.weekday} ${d.day} ${d.month}`}
            onClick={() => onChange(active && allowNone ? null : d.key)}
            whileTap={{ scale: 0.95 }}
            transition={SPRING}
            className={cn(
              "relative isolate flex h-[76px] w-[58px] shrink-0 select-none flex-col items-center justify-center rounded-inner transition-colors duration-200",
              active ? "text-ink" : "text-ink3",
              !active && (tone === "canvas" ? "bg-surface/55" : "bg-soft"),
            )}
          >
            {active && (
              <motion.span layoutId={`day-${id}`} transition={SPRING} className="absolute inset-0 -z-10 rounded-inner bg-surface shadow-card">
                <span className="absolute left-1/2 top-2 h-1 w-5 -translate-x-1/2 rounded-full bg-accent" />
              </motion.span>
            )}
            <span className={cn("tnum mt-1.5 text-xl leading-6", active ? "font-semibold" : "font-medium")}>{d.day}</span>
            <span className="text-2xs">{d.isToday ? "Today" : d.weekday}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
