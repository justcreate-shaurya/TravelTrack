"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";
import { useIsDesktop } from "@/lib/useMediaQuery";

import { IconButton } from "./Button";
import { SPRING } from "./motion";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Heading shown in the sheet header; also names the dialog. */
  title?: ReactNode;
  /** One muted line under the title. */
  description?: ReactNode;
  /** Accessible name when there is no visible title. */
  ariaLabel?: string;
  /** Replaces the default title row (e.g. a wizard's back button + progress). The close button is not rendered. */
  header?: ReactNode;
  /** Pinned under the scrolling body, above the safe area: the primary action goes here. */
  footer?: ReactNode;
  /** "auto" hugs the content (up to 92% of the screen); "tall" always takes 92%. */
  height?: "auto" | "tall";
  /** Set false to block backdrop tap, drag-down and Escape (e.g. while submitting). */
  dismissible?: boolean;
  /** Body padding is px-5 by default; pass false to lay it out yourself. */
  padded?: boolean;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Only the top-most open sheet reacts to Escape and Tab; the page scroll is locked while any is open.
const stack: symbol[] = [];

function lockScroll() {
  if (stack.length === 1) document.documentElement.style.overflow = "hidden";
}
function unlockScroll() {
  if (stack.length === 0) document.documentElement.style.overflow = "";
}

/**
 * Bottom sheet on phones: springs up, drags down to dismiss (from the handle/header), fading
 * backdrop, focus trap, Escape to close, safe-area padding. At lg and up it is a centred dialog
 * that fades and scales in instead (no handle, no drag). Rendered in a portal; sheets can be nested.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  ariaLabel,
  header,
  footer,
  height = "auto",
  dismissible = true,
  padded = true,
  children,
  className,
}: SheetProps) {
  const [mounted, setMounted] = useState(false);
  const desktop = useIsDesktop();
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useDragControls();
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dismissRef = useRef(dismissible);
  dismissRef.current = dismissible;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const token = Symbol("sheet");
    stack.push(token);
    lockScroll();
    const previous = document.activeElement as HTMLElement | null;

    // Move focus inside without popping the keyboard: the panel itself, not the first input.
    const focusTimer = setTimeout(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === "Escape") {
        if (dismissRef.current) {
          e.stopPropagation();
          closeRef.current();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
      unlockScroll();
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [open]);

  const onDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (!dismissRef.current) return;
    if (info.offset.y > 120 || info.velocity.y > 700) closeRef.current();
  }, []);

  if (!mounted) return null;

  const startDrag = (e: React.PointerEvent) => {
    if (!dismissible || desktop) return;
    // Buttons in the header stay tappable.
    if ((e.target as HTMLElement).closest("button,a,input,[role='radio']")) return;
    drag.start(e);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6">
          <motion.div
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => dismissible && onClose()}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title ? undefined : ariaLabel}
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className={cn(
              "relative flex w-full max-w-phone flex-col rounded-t-card bg-surface text-ink shadow-float outline-none",
              "max-h-[92dvh] lg:max-h-[88dvh] lg:max-w-[600px] lg:rounded-card",
              height === "tall" && "h-[92dvh] lg:h-[min(800px,88dvh)]",
              className,
            )}
            initial={desktop ? { opacity: 0, scale: 0.96, y: 16 } : { y: "100%" }}
            animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={
              desktop
                ? { opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.16 } }
                : { y: "100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }
            }
            transition={SPRING}
            drag={dismissible && !desktop ? "y" : false}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            <div onPointerDown={startDrag} className="shrink-0 touch-none">
              <div className="flex justify-center pb-1 pt-2.5 lg:hidden" aria-hidden>
                <span className="h-1.5 w-10 rounded-full bg-ink/15" />
              </div>
              {header ??
                (title != null && (
                  <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-2 lg:px-7 lg:pt-6">
                    <div className="min-w-0">
                      <h2 id={titleId} className="text-xl font-semibold leading-7">
                        {title}
                      </h2>
                      {description != null && <p className="mt-0.5 text-sm text-ink3">{description}</p>}
                    </div>
                    {dismissible && (
                      <IconButton label="Close" onClick={onClose} size="sm" className="mt-0.5">
                        <X size={18} strokeWidth={1.75} />
                      </IconButton>
                    )}
                  </div>
                ))}
            </div>

            <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", padded && "px-5 lg:px-7", !footer && "pb-safe lg:pb-6")}>
              {children}
            </div>

            {footer != null && <div className="pb-safe shrink-0 border-t border-line px-5 pt-3 lg:px-7 lg:pb-5">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
