"use client";

import { LoaderCircle } from "lucide-react";
import { motion, type HTMLMotionProps } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { SPRING } from "./motion";

export type ButtonVariant = "primary" | "dark" | "soft" | "ghost" | "danger" | "onDark";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accentInk shadow-glow",
  dark: "bg-ink text-surface",
  soft: "bg-soft text-ink",
  ghost: "bg-transparent text-ink2",
  danger: "bg-danger/10 text-danger",
  /** Quiet button for dark cards and the dark ride-page action bar. */
  onDark: "bg-white/10 text-ondark",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-11 px-4 text-sm gap-1.5",
  md: "h-12 px-5 text-[15px] gap-2",
  lg: "h-14 px-6 text-base gap-2",
};

/** Class string for a button-looking element, for the rare case Button itself can't be used. */
export function buttonClass(opts: { variant?: ButtonVariant; size?: ButtonSize; full?: boolean } = {}): string {
  return cn(
    "relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-semibold",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    VARIANTS[opts.variant ?? "primary"],
    SIZES[opts.size ?? "md"],
    opts.full && "w-full",
  );
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width. */
  full?: boolean;
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  /** Leading icon, e.g. <Plus size={18} />. */
  icon?: ReactNode;
  /** Trailing icon. */
  iconRight?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export type ButtonProps = CommonProps &
  Omit<HTMLMotionProps<"button">, "children" | "className"> & {
    /** Renders a link instead of a button: internal paths use next/link, anything else a plain anchor (upi:, https:, wa.me). */
    href?: string;
    target?: string;
    rel?: string;
  };

function Inner({ loading, icon, iconRight, children }: Pick<CommonProps, "loading" | "icon" | "iconRight" | "children">) {
  return (
    <>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <LoaderCircle size={20} strokeWidth={2} className="animate-spin" />
        </span>
      )}
      <span className={cn("inline-flex min-w-0 items-center justify-center gap-[inherit]", loading && "opacity-0")}>
        {icon}
        {children != null && <span className="truncate">{children}</span>}
        {iconRight}
      </span>
    </>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  full,
  loading,
  icon,
  iconRight,
  children,
  className,
  href,
  target,
  rel,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const cls = cn(buttonClass({ variant, size, full }), className);
  const inner = (
    <Inner loading={loading} icon={icon} iconRight={iconRight}>
      {children}
    </Inner>
  );

  if (href !== undefined) {
    const off = disabled || loading;
    const linkCls = cn(cls, "press");
    if (href.startsWith("/")) {
      return (
        <Link href={href} className={linkCls} aria-disabled={off || undefined} tabIndex={off ? -1 : undefined}>
          {inner}
        </Link>
      );
    }
    return (
      <a href={href} target={target} rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)} className={linkCls} aria-disabled={off || undefined}>
        {inner}
      </a>
    );
  }

  return (
    <motion.button
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
      {...rest}
    >
      {inner}
    </motion.button>
  );
}

export type IconButtonVariant = "soft" | "surface" | "dark" | "ghost" | "accent" | "onDark";

const ICON_VARIANTS: Record<IconButtonVariant, string> = {
  soft: "bg-soft text-ink",
  surface: "bg-surface text-ink shadow-card",
  dark: "bg-ink text-surface",
  ghost: "bg-transparent text-ink2",
  accent: "bg-accent text-accentInk",
  /** For use on dark cards and the dark ride-page header. */
  onDark: "bg-white/10 text-ondark",
};

const ICON_SIZES = { sm: "h-9 w-9", md: "h-11 w-11", lg: "h-14 w-14" } as const;

export type IconButtonProps = Omit<HTMLMotionProps<"button">, "children" | "className" | "aria-label"> & {
  /** Accessible name (required): becomes aria-label. */
  label: string;
  /** The icon, e.g. <Bell size={20} strokeWidth={1.75} />. */
  children: ReactNode;
  variant?: IconButtonVariant;
  /** md (44px) is the default; sm (36px) keeps a 44px hit area. */
  size?: keyof typeof ICON_SIZES;
  /** Renders a next/link (internal path) or anchor instead of a button. */
  href?: string;
  /** For external links, e.g. "_blank" (rel defaults to noopener noreferrer). */
  target?: string;
  rel?: string;
  /** Small accent dot in the corner (unread, active). */
  dot?: boolean;
  className?: string;
};

export function IconButton({
  label,
  children,
  variant = "soft",
  size = "md",
  href,
  target,
  rel,
  dot,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const cls = cn(
    "relative inline-flex shrink-0 select-none items-center justify-center rounded-full",
    "disabled:pointer-events-none disabled:opacity-50",
    // Keeps the hit area at 44px even for the small visual size.
    size === "sm" && "before:absolute before:-inset-1 before:content-['']",
    ICON_VARIANTS[variant],
    ICON_SIZES[size],
    className,
  );
  const inner = (
    <>
      {children}
      {dot && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-surface" aria-hidden />}
    </>
  );
  if (href !== undefined) {
    return href.startsWith("/") ? (
      <Link href={href} aria-label={label} className={cn(cls, "press")}>
        {inner}
      </Link>
    ) : (
      <a href={href} target={target} rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)} aria-label={label} className={cn(cls, "press")}>
        {inner}
      </a>
    );
  }
  return (
    <motion.button type={type} aria-label={label} className={cls} whileTap={{ scale: 0.92 }} transition={SPRING} {...rest}>
      {inner}
    </motion.button>
  );
}
