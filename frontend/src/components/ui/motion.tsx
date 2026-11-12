"use client";

import { motion, type Transition, type Variants } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Default spring for sheets, tabs, pills and presses. */
export const SPRING: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 1 };
/** A touch bouncier: seats popping, success check, numbers. */
export const SPRING_POP: Transition = { type: "spring", stiffness: 460, damping: 30, mass: 0.9 };
/** Fades and small slides. */
export const EASE: Transition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] };
/** Spread onto any motion element that should give on press. */
export const PRESS = { whileTap: { scale: 0.97 }, transition: SPRING } as const;

/** Stagger step between list items, seconds. */
export const STAGGER_STEP = 0.035;

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER_STEP, delayChildren: 0.04 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: SPRING },
};

/** Fades and slides the page content up on every route change. AppShell already wraps its children in this. */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  const path = usePathname();
  return (
    <motion.div
      key={path}
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** A list whose StaggerItem children animate in one after another (35ms apart). */
export function Stagger({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul";
}) {
  const Comp = as === "ul" ? motion.ul : motion.div;
  return (
    <Comp className={className} variants={listVariants} initial="hidden" animate="show">
      {children}
    </Comp>
  );
}

/** One row of a Stagger list. Items added later animate in on their own. */
export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp className={className} variants={itemVariants}>
      {children}
    </Comp>
  );
}

/** Fades and lifts a single block in on mount (hero text, cards outside a Stagger). */
export function FadeIn({
  children,
  className,
  delay = 0,
  y = 10,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
