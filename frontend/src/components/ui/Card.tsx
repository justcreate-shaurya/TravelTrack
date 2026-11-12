"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { SPRING } from "./motion";

export type CardTone = "surface" | "soft" | "dark" | "warn" | "accent";

const TONES: Record<CardTone, string> = {
  surface: "bg-surface text-ink shadow-card",
  soft: "bg-soft text-ink",
  /** The dark feature card. Adds `.on-dark`, so `.label`, focus rings and skeletons adapt. */
  dark: "on-dark bg-dark text-ondark shadow-float",
  /** The urgency / Near-you yellow. */
  warn: "bg-warn text-warnInk",
  accent: "bg-accent text-accentInk",
};

export interface CardProps {
  children: ReactNode;
  tone?: CardTone;
  /** "card" = 28px (big screen cards), "inner" = 20px (cards inside cards). */
  radius?: "card" | "inner";
  /** Padding preset: "md" p-5 (default), "sm" p-4, "none". */
  pad?: "none" | "sm" | "md";
  /** Makes the whole card a link (next/link) that scales on press. */
  href?: string;
  /** Makes the whole card a button that scales on press. */
  onClick?: () => void;
  /** Accessible name when the card is a link or button. */
  "aria-label"?: string;
  className?: string;
}

/** The basic rounded surface. Becomes pressable (scale 0.97) when given `href` or `onClick`. */
export function Card({ children, tone = "surface", radius = "card", pad = "md", href, onClick, className, ...rest }: CardProps) {
  const cls = cn(
    "relative block w-full text-left",
    TONES[tone],
    radius === "card" ? "rounded-card" : "rounded-inner",
    pad === "md" && "p-5",
    pad === "sm" && "p-4",
    className,
  );
  if (href !== undefined) {
    return (
      <motion.div whileTap={{ scale: 0.97 }} transition={SPRING}>
        <Link href={href} className={cls} {...rest}>
          {children}
        </Link>
      </motion.div>
    );
  }
  if (onClick) {
    return (
      <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.97 }} transition={SPRING} className={cls} {...rest}>
        {children}
      </motion.button>
    );
  }
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}

export interface TicketCardProps {
  /** The main part of the ticket, above the perforation. */
  children: ReactNode;
  /** The stub below the perforation (details row, actions, QR-like footer). Omit for a plain card with no notches. */
  stub?: ReactNode;
  /** "light" = surface ticket (on canvas or on the dark ride-page backdrop); "dark" = dark ticket. */
  tone?: "light" | "dark";
  /** Makes the whole ticket a pressable link. */
  href?: string;
  "aria-label"?: string;
  /** Classes for the main part (padding defaults to p-5). */
  bodyClassName?: string;
  /** Classes for the stub (padding defaults to px-5 pb-5 pt-1). */
  stubClassName?: string;
  className?: string;
}

/**
 * Ticket shell: a card split by a dashed perforation with semicircular side notches.
 * The notches are real cut-outs (CSS mask), so the ticket works on any backdrop.
 */
export function TicketCard({
  children,
  stub,
  tone = "light",
  href,
  bodyClassName,
  stubClassName,
  className,
  ...rest
}: TicketCardProps) {
  const fill = tone === "dark" ? "bg-dark" : "bg-surface";
  const inner = (
    <>
      <div className={cn(fill, "rounded-t-card", stub == null && "rounded-b-card", bodyClassName ?? "p-5")}>{children}</div>
      {stub != null && (
        <>
          <div className={cn("ticket-notch -my-px", fill)} aria-hidden />
          <div className={cn(fill, "rounded-b-card", stubClassName ?? "px-5 pb-5 pt-1")}>{stub}</div>
        </>
      )}
    </>
  );
  const cls = cn(
    "relative block w-full text-left",
    tone === "dark" ? "on-dark text-ondark" : "text-ink",
    // drop-shadow follows the notched outline; box-shadow would not.
    "[filter:drop-shadow(0_10px_18px_rgba(13,18,16,0.12))]",
    className,
  );
  if (href !== undefined) {
    return (
      <motion.div whileTap={{ scale: 0.97 }} transition={SPRING}>
        <Link href={href} className={cls} {...rest}>
          {inner}
        </Link>
      </motion.div>
    );
  }
  return (
    <div className={cls} {...rest}>
      {inner}
    </div>
  );
}
