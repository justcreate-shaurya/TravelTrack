"use client";

import { motion } from "motion/react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { SPRING } from "./motion";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedTabsProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group, e.g. "Direction". */
  label: string;
  /** "surface" = white track (on the canvas), "soft" = grey track (inside white cards), "dark" = on dark cards. */
  tone?: "surface" | "soft" | "dark";
  size?: "sm" | "md";
  /** Fill the row (default; options grow from their content width, labels are never clipped) or hug the content. */
  full?: boolean;
  className?: string;
}

/** Segmented control with a pill that slides between options (shared layout animation). */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  tone = "surface",
  size = "md",
  full = true,
  className,
}: SegmentedTabsProps<T>) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, index: number) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    for (let step = 1; step <= options.length; step++) {
      const next = (index + dir * step + options.length * step) % options.length;
      if (!options[next].disabled) {
        onChange(options[next].value);
        refs.current[next]?.focus();
        return;
      }
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "relative isolate rounded-full p-1",
        full ? "flex" : "inline-flex",
        tone === "surface" && "bg-surface",
        tone === "soft" && "bg-soft",
        tone === "dark" && "bg-white/10",
        className,
      )}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors duration-200",
              "disabled:opacity-40",
              full && "flex-auto",
              size === "md" ? cn("h-11 text-sm", full ? "px-3" : "px-4") : "h-9 px-3 text-label",
              active
                ? tone === "dark"
                  ? "text-accentInk"
                  : "text-surface"
                : tone === "dark"
                  ? "text-ondark2"
                  : "text-ink2",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={SPRING}
                className={cn("absolute inset-0 -z-10 rounded-full", tone === "dark" ? "bg-accent" : "bg-ink")}
              />
            )}
            {o.icon}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
