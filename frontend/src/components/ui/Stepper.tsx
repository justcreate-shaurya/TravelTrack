"use client";

import { Minus, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";

import { SPRING, SPRING_POP } from "./motion";

export interface AnimatedNumberProps {
  value: number;
  /** Turns the number into text, e.g. (n) => `₹${n}`. Default: String(n). */
  format?: (value: number) => string;
  className?: string;
}

/** A number that rolls up or down when it changes (seats left, fare split, stepper values). */
export function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
  const prev = useRef(value);
  const dir = useRef(1);
  if (value !== prev.current) {
    dir.current = value > prev.current ? 1 : -1;
    prev.current = value;
  }
  const text = format ? format(value) : String(value);
  const d = dir.current;
  return (
    <span className={cn("tnum relative inline-flex overflow-hidden align-bottom", className)}>
      <AnimatePresence mode="popLayout" initial={false} custom={d}>
        <motion.span
          key={text}
          custom={d}
          variants={{
            enter: (dd: number) => ({ y: `${dd * 70}%`, opacity: 0 }),
            center: { y: "0%", opacity: 1 },
            exit: (dd: number) => ({ y: `${dd * -70}%`, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={SPRING_POP}
          className="inline-block whitespace-nowrap"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Shown on the left; also names the control for screen readers. */
  label: string;
  /** Muted line under the label, e.g. "Including you". */
  hint?: ReactNode;
  /** Optional leading icon in a soft circle. */
  icon?: ReactNode;
  /** Word after the number for screen readers, e.g. "seats". */
  unit?: string;
  disabled?: boolean;
  className?: string;
}

/** Label on the left, minus / animated number / plus on the right. */
export function Stepper({ value, onChange, min = 1, max = 6, label, hint, icon, unit, disabled, className }: StepperProps) {
  const set = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped !== value) {
      haptic(8);
      onChange(clamped);
    }
  };
  const btn =
    "inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-card disabled:opacity-35 disabled:shadow-none";
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-inner bg-soft p-3 pl-4", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink2">{icon}</span>}
        <div className="min-w-0">
          <p className="font-medium leading-snug">{label}</p>
          {hint != null && <p className="text-label text-ink3">{hint}</p>}
        </div>
      </div>
      <div
        role="group"
        aria-label={label}
        className="flex shrink-0 items-center gap-1"
      >
        <motion.button
          type="button"
          className={btn}
          aria-label={`Fewer: ${label}`}
          disabled={disabled || value <= min}
          onClick={() => set(value - 1)}
          whileTap={{ scale: 0.9 }}
          transition={SPRING}
        >
          <Minus size={18} strokeWidth={1.75} />
        </motion.button>
        <span className="w-9 text-center text-xl font-semibold" aria-live="polite" aria-atomic>
          <AnimatedNumber value={value} />
          {unit && <span className="sr-only"> {unit}</span>}
        </span>
        <motion.button
          type="button"
          className={btn}
          aria-label={`More: ${label}`}
          disabled={disabled || value >= max}
          onClick={() => set(value + 1)}
          whileTap={{ scale: 0.9 }}
          transition={SPRING}
        >
          <Plus size={18} strokeWidth={1.75} />
        </motion.button>
      </div>
    </div>
  );
}
