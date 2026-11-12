"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { Vehicle } from "@/lib/types";

import { VehicleIcon } from "./VehicleIcon";

export interface RouteLineProps {
  /** horizontal: start on the left, end on the right. vertical: start on top (From/To cards). */
  orientation?: "horizontal" | "vertical";
  /** "dark" when placed on a dark card. */
  tone?: "light" | "dark";
  /** Line colour. Default: ink on light, accent on dark. "warn" is the yellow of the settled-ride card. */
  color?: "ink" | "accent" | "warn";
  /** "trip": solid up to the vehicle, dashed after it. "solid": one solid line end to end. */
  variant?: "trip" | "solid";
  /** Vehicle whose icon rides the line. Omit (and omit `icon`) for a bare line. */
  vehicle?: Vehicle | null;
  /** Custom marker instead of the vehicle icon (e.g. a clock for the settled-ride card). */
  icon?: ReactNode;
  /** Where the marker rests, 0..1 from the start. Default 0.5. */
  progress?: number;
  /**
   * "mount": the line draws itself and the marker travels to its spot once.
   * "loop": the same, then the marker idles with a gentle back-and-forth (ride page).
   * "none": static.
   */
  animate?: "mount" | "loop" | "none";
  /** Marker size: sm 24px, md 30px, lg 44px. */
  size?: "sm" | "md" | "lg";
  /** Delay before the draw-in starts, seconds (to chain after a card's entrance). */
  delay?: number;
  className?: string;
}

const MARKER = { sm: 24, md: 30, lg: 44 } as const;
const ICON = { sm: 14, md: 17, lg: 22 } as const;

/**
 * Ticket-style route: start dot, a line with a marker travelling along it, end dot.
 * Fills the width (horizontal) or height (vertical) of its container.
 */
export function RouteLine({
  orientation = "horizontal",
  tone = "light",
  color,
  variant = "trip",
  vehicle,
  icon,
  progress = 0.5,
  animate = "mount",
  size = "md",
  delay = 0,
  className,
}: RouteLineProps) {
  const reduce = useReducedMotion();
  const [arrived, setArrived] = useState(false);
  const horizontal = orientation === "horizontal";
  const p = Math.min(1, Math.max(0, progress));
  const pct = p * 100;
  const tint = color ?? (tone === "dark" ? "accent" : "ink");
  const lineColor = tint === "accent" ? "text-accent" : tint === "warn" ? "text-warn" : "text-ink";
  const markerColor =
    tint === "accent" ? "bg-accent text-accentInk" : tint === "warn" ? "bg-warn text-warnInk" : "bg-ink text-surface";
  const marker = icon ?? (vehicle ? <VehicleIcon vehicle={vehicle} size={ICON[size]} /> : null);
  const still = animate === "none" || !!reduce;
  const solidEnd = variant === "solid" ? 100 : pct;
  const axis = horizontal ? "x" : "y";
  const box = MARKER[size];

  const travel = still
    ? { [axis]: `${pct}%` }
    : arrived && animate === "loop"
      ? { [axis]: [`${pct}%`, `${Math.min(100, pct + 5)}%`, `${Math.max(0, pct - 5)}%`, `${pct}%`] }
      : { [axis]: `${pct}%` };

  const travelTransition =
    arrived && animate === "loop"
      ? { duration: 5, ease: "easeInOut" as const, repeat: Infinity }
      : { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const, delay };

  return (
    <div
      className={cn("flex items-center", horizontal ? "w-full flex-row" : "h-full flex-col", lineColor, className)}
      style={horizontal ? { height: box } : { width: box }}
      aria-hidden
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-current" />

      <div className={cn("relative flex-1", horizontal ? "mx-1 h-full" : "my-1 min-h-6 w-full")}>
        {/* Base: dashed track end to end */}
        <svg
          className={cn("absolute overflow-visible opacity-40", horizontal ? "inset-x-0 top-1/2 -translate-y-px" : "inset-y-0 left-1/2 -translate-x-px")}
          width={horizontal ? "100%" : 2}
          height={horizontal ? 2 : "100%"}
        >
          <line
            x1={horizontal ? 0 : 1}
            y1={horizontal ? 1 : 0}
            x2={horizontal ? "100%" : 1}
            y2={horizontal ? 1 : "100%"}
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray="4 6"
            strokeLinecap="round"
          />
        </svg>

        {/* Travelled part: solid, draws itself */}
        {solidEnd > 0 && (
          <svg
            className={cn("absolute overflow-visible", horizontal ? "left-0 top-1/2 -translate-y-px" : "left-1/2 top-0 -translate-x-px")}
            width={horizontal ? `${solidEnd}%` : 2}
            height={horizontal ? 2 : `${solidEnd}%`}
          >
            <motion.line
              x1={horizontal ? 0 : 1}
              y1={horizontal ? 1 : 0}
              x2={horizontal ? "100%" : 1}
              y2={horizontal ? 1 : "100%"}
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              initial={still ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay }}
            />
          </svg>
        )}

        {marker && (
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={still ? false : { [axis]: "0%", opacity: 0 }}
            animate={{ ...travel, opacity: 1 }}
            transition={travelTransition}
            onAnimationComplete={() => {
              if (animate === "loop" && !arrived) setArrived(true);
            }}
          >
            <span
              className={cn(
                "absolute inline-flex items-center justify-center rounded-full",
                horizontal ? "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" : "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
                markerColor,
              )}
              style={{ width: box, height: box }}
            >
              {marker}
            </span>
          </motion.div>
        )}
      </div>

      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-current" />
    </div>
  );
}
