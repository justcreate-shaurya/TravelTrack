"use client";

import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/cn";

import { SPRING_POP } from "./motion";

// Soft tints that read on both themes: mint, amber, lime, coral, teal, sand.
const HUES = [150, 42, 95, 16, 176, 60];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Up to two initials from a name. */
export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** Deterministic background/text colours for a name (or id). */
export function avatarTint(seed: string): { background: string; color: string } {
  const hue = HUES[hash(seed) % HUES.length];
  return { background: `hsl(${hue} 72% 84%)`, color: `hsl(${hue} 55% 18%)` };
}

const SIZES = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 } as const;
export type AvatarSize = keyof typeof SIZES;

export interface AvatarProps {
  name: string;
  /** Stable seed for the tint (user id). Defaults to the name. */
  seed?: string;
  /** Photo URL; initials are shown when missing. */
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}

/** Round avatar with initials on a deterministic tint. Decorative by default; put the name next to it. */
export function Avatar({ name, seed, src, size = "md", className }: AvatarProps) {
  const px = SIZES[size];
  return (
    <span
      className={cn("inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold", className)}
      style={{ width: px, height: px, fontSize: Math.round(px * 0.38), ...avatarTint(seed ?? name) }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export interface AvatarStackProps {
  users: { id: string; name: string }[];
  /** Avatars shown before the "+N" bubble. */
  max?: number;
  size?: AvatarSize;
  /** Colour of the ring separating the avatars: match the card they sit on. */
  ring?: "surface" | "soft" | "dark" | "canvas" | "warn";
  className?: string;
}

const RINGS = {
  surface: "ring-surface",
  soft: "ring-soft",
  dark: "ring-dark",
  canvas: "ring-canvas",
  warn: "ring-warn",
} as const;

/** Overlapping rider avatars; new riders pop in (also on live updates). */
export function AvatarStack({ users, max = 4, size = "sm", ring = "surface", className }: AvatarStackProps) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  const px = SIZES[size];
  const names = users.map((u) => u.name).join(", ");
  return (
    <span
      className={cn("inline-flex items-center", className)}
      role="img"
      aria-label={users.length ? `Riders: ${names}` : "No riders yet"}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((u, i) => (
          <motion.span
            key={u.id}
            layout
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={SPRING_POP}
            className={cn("inline-flex rounded-full ring-2", RINGS[ring])}
            style={{ marginLeft: i === 0 ? 0 : -Math.round(px * 0.28), zIndex: shown.length - i }}
          >
            <Avatar name={u.name} seed={u.id} size={size} />
          </motion.span>
        ))}
      </AnimatePresence>
      {extra > 0 && (
        <span
          className={cn("tnum inline-flex items-center justify-center rounded-full bg-ink font-semibold text-surface ring-2", RINGS[ring])}
          style={{ width: px, height: px, marginLeft: -Math.round(px * 0.28), fontSize: Math.round(px * 0.36) }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
