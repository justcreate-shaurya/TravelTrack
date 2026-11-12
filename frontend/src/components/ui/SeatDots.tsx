"use client";

import { motion } from "motion/react";

import { cn } from "@/lib/cn";

import { SPRING_POP } from "./motion";

export interface SeatDotsProps {
  /** Seats already taken (filled, accent). */
  taken: number;
  /** Total seats in the ride (min(max_seats, vehicle_seats) = seats_taken + seats_open). */
  total: number;
  /** "dark" when placed on a dark card. */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: "h-2.5 w-2.5", md: "h-3.5 w-3.5", lg: "h-5 w-5" } as const;
const GAPS = { sm: "gap-1", md: "gap-1.5", lg: "gap-2" } as const;

/**
 * One dot per seat. Dots pop in one by one on mount; a seat fills with a spring when
 * `taken` goes up (your own join or a live update) and empties when someone leaves.
 */
export function SeatDots({ taken, total, tone = "light", size = "md", className }: SeatDotsProps) {
  const count = Math.max(0, total);
  const filled = Math.min(count, Math.max(0, taken));
  return (
    <span
      className={cn("inline-flex items-center", GAPS[size], className)}
      role="img"
      aria-label={`${filled} of ${count} seats taken`}
    >
      {Array.from({ length: count }, (_, i) => (
        <motion.span
          key={i}
          className={cn("relative inline-block rounded-full", SIZES[size], tone === "dark" ? "bg-white/15" : "bg-ink/10")}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SPRING_POP, delay: i * 0.045 }}
        >
          <motion.span
            className="absolute inset-0 rounded-full bg-accent"
            initial={false}
            animate={{ scale: i < filled ? 1 : 0, opacity: i < filled ? 1 : 0 }}
            transition={SPRING_POP}
          />
        </motion.span>
      ))}
    </span>
  );
}
