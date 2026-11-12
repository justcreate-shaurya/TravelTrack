"use client";

import { AnimatePresence, motion } from "motion/react";
import { cloneElement, isValidElement, useId, type ComponentProps, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Class for any text control: 16px text (no iOS zoom), 52px tall, 16px radius, soft fill. Same as the `.field` CSS class. */
export const inputClass = "field";

export interface FieldProps {
  label: string;
  /** Muted helper line under the control. */
  hint?: ReactNode;
  /** Error message; replaces the hint and marks the control invalid. */
  error?: string | null;
  /** Shown after the label in muted text, e.g. "Optional". */
  aside?: ReactNode;
  /** A single control (Input, Textarea, select...). It receives id, aria-invalid and aria-describedby. */
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
  className?: string;
}

/** Label + control + hint/error, wired up for screen readers. */
export function Field({ label, hint, error, aside, children, className }: FieldProps) {
  const auto = useId();
  const id = (isValidElement(children) && children.props.id) || auto;
  const noteId = `${id}-note`;
  const hasNote = !!error || hint != null;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
        <label htmlFor={id} className="text-label font-medium text-ink2">
          {label}
        </label>
        {aside != null && <span className="text-label text-ink3">{aside}</span>}
      </div>
      {cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": hasNote ? noteId : undefined,
      })}
      <AnimatePresence initial={false} mode="wait">
        {hasNote && (
          <motion.p
            key={error ? "error" : "hint"}
            id={noteId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={cn("mt-1.5 px-1 text-label", error ? "text-danger" : "text-ink3")}
            role={error ? "alert" : undefined}
          >
            {error || hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface InputProps extends Omit<ComponentProps<"input">, "prefix"> {
  /** Icon or short text inside the left edge (e.g. a search icon or "₹"). */
  leading?: ReactNode;
  /** Element inside the right edge (e.g. a clear button or unit). */
  trailing?: ReactNode;
  /** White fill with a hairline border, for use on soft or canvas backgrounds. */
  surface?: boolean;
}

/** Text input styled with the field tokens. Accepts every native input prop, plus `ref`. */
export function Input({ leading, trailing, surface, className, ...rest }: InputProps) {
  const input = (
    <input
      {...rest}
      className={cn("field", surface && "field-surface", leading != null && "pl-11", trailing != null && "pr-12", className)}
    />
  );
  if (leading == null && trailing == null) return input;
  return (
    <span className="relative block">
      {leading != null && (
        <span className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 items-center text-ink3">{leading}</span>
      )}
      {input}
      {trailing != null && <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">{trailing}</span>}
    </span>
  );
}

export interface TextareaProps extends ComponentProps<"textarea"> {
  surface?: boolean;
}

/** Multi-line input with the same styling. */
export function Textarea({ surface, className, rows = 3, ...rest }: TextareaProps) {
  return <textarea rows={rows} {...rest} className={cn("field resize-none", surface && "field-surface", className)} />;
}
