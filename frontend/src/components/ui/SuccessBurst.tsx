"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

import { cn } from "@/lib/cn";
import { haptic, SUCCESS_HAPTIC } from "@/lib/haptics";
import { useStore } from "@/lib/store";

import { SPRING_POP } from "./motion";

const RAYS = Array.from({ length: 10 }, (_, i) => (i * 360) / 10);

export interface SuccessCheckProps {
  /** Diameter in px. */
  size?: number;
  className?: string;
}

/** The animated mark on its own: an accent disc springs in, the check draws, rays burst outwards. */
export function SuccessCheck({ size = 88, className }: SuccessCheckProps) {
  return (
    <span className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }} aria-hidden>
      {RAYS.map((deg, i) => (
        <span key={deg} className="absolute inset-0" style={{ transform: `rotate(${deg}deg)` }}>
          <motion.span
            className={cn("absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full", i % 2 ? "bg-warn" : "bg-accent")}
            initial={{ y: 0, opacity: 0, scale: 0.4 }}
            animate={{ y: -size * 0.82, opacity: [0, 1, 0], scale: [0.4, 1.2, 0.6] }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
          />
        </span>
      ))}
      <motion.span
        className="absolute inset-0 rounded-full bg-accent shadow-glow"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING_POP}
      />
      <svg viewBox="0 0 48 48" width={size * 0.56} height={size * 0.56} className="relative text-accentInk" fill="none">
        <motion.path
          d="M12 25.5l8 8L36.5 16"
          stroke="currentColor"
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1], delay: 0.16 }}
        />
      </svg>
    </span>
  );
}

export interface SuccessBurstProps {
  /** Show the overlay. */
  show: boolean;
  /** Short confirmation, e.g. "Ride posted". */
  label?: string;
  /** Called after the moment has played (about 1.4s): set `show` back to false here. */
  onDone?: () => void;
  /** How long it stays up, ms. */
  duration?: number;
}

/**
 * Full-screen success moment: dimmed backdrop, animated check burst, a label and a short
 * vibration. Controlled; for the common case use the global one: useStore's celebrate("Joined").
 */
export function SuccessBurst({ show, label, onDone, duration = 1400 }: SuccessBurstProps) {
  useEffect(() => {
    if (!show) return;
    haptic(SUCCESS_HAPTIC);
    const id = setTimeout(() => onDone?.(), duration);
    return () => clearTimeout(id);
    // onDone is intentionally not a dependency: a new callback identity must not restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, duration]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-black/55"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="polite"
          onClick={() => onDone?.()}
        >
          <SuccessCheck size={96} />
          {label && (
            <motion.p
              className="px-6 text-center text-2xl font-semibold text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: 0.22 }}
            >
              {label}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The global success moment driven by the store (celebrate / clearSuccess). Mounted once in the root layout. */
export function SuccessHost() {
  const success = useStore((s) => s.success);
  const clear = useStore((s) => s.clearSuccess);
  return <SuccessBurst key={success?.id ?? 0} show={!!success} label={success?.label} onDone={clear} />;
}
