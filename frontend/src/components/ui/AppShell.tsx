"use client";

import { CarTaxiFront, House, Plus, Ticket, UserRound, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { ROUTES } from "@/lib/routes";
import { useStore } from "@/lib/store";

import { Avatar } from "./Avatar";
import { PageTransition, SPRING } from "./motion";

// Defined in lib/routes so files that AppShell itself imports (the create wizard) can use them too.
export { ROUTES };

type TabKey = "home" | "rides" | "profile";

const TABS: { key: TabKey; href: string; label: string; icon: LucideIcon }[] = [
  { key: "home", href: ROUTES.home, label: "Home", icon: House },
  { key: "rides", href: ROUTES.rides, label: "My rides", icon: Ticket },
  { key: "profile", href: ROUTES.profile, label: "Profile", icon: UserRound },
];

function activeTab(path: string): TabKey | null {
  if (path === "/") return "home";
  if (path.startsWith(ROUTES.rides)) return "rides";
  if (path.startsWith(ROUTES.profile)) return "profile";
  return null;
}

function NavTab({ tab, active }: { tab: (typeof TABS)[number]; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-[52px] min-w-0 flex-1 select-none flex-col items-center justify-center gap-0.5 rounded-full text-2xs font-medium transition-colors duration-200",
        active ? "text-ink" : "text-ink3",
      )}
    >
      {active && <motion.span layoutId="nav-pill" transition={SPRING} className="absolute inset-0 rounded-full bg-soft" />}
      <motion.span className="relative" animate={{ y: active ? -1 : 0, scale: active ? 1.06 : 1 }} transition={SPRING}>
        <Icon size={21} strokeWidth={active ? 2.1 : 1.75} aria-hidden />
      </motion.span>
      <span className="relative truncate">{tab.label}</span>
    </Link>
  );
}

/**
 * Floating bottom navigation: Home, My rides, the raised "+" (opens the create wizard), Profile.
 * Rendered once by the signed-in layout (app/(app)/layout.tsx) so it persists across tab changes
 * and the active pill slides. It hides itself on focused pages (the ride page).
 */
export function BottomNav() {
  const path = usePathname();
  const openCreate = useStore((s) => s.openCreate);
  const current = activeTab(path);
  const [home, rides, profile] = TABS;
  return (
    <AnimatePresence initial={false}>
      {current !== null && (
        <motion.nav
          key="nav"
          aria-label="Main"
          className="bottom-nav-gap pointer-events-none fixed inset-x-0 z-40 mx-auto w-full max-w-phone px-4 lg:hidden"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={SPRING}
        >
          <div className="frost pointer-events-auto flex h-[68px] items-center gap-1 rounded-full px-2 shadow-nav">
            <NavTab tab={home} active={current === "home"} />
            <NavTab tab={rides} active={current === "rides"} />
            <div className="flex w-[68px] shrink-0 justify-center">
              <motion.button
                type="button"
                aria-label="Post a ride"
                onClick={() => {
                  haptic(10);
                  openCreate();
                }}
                whileTap={{ scale: 0.9, rotate: 90 }}
                transition={SPRING}
                className="-mt-7 inline-flex h-[60px] w-[60px] items-center justify-center rounded-full bg-accent text-accentInk shadow-glow ring-[5px] ring-canvas"
              >
                <Plus size={26} strokeWidth={2.2} aria-hidden />
              </motion.button>
            </div>
            <NavTab tab={profile} active={current === "profile"} />
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

/**
 * Desktop navigation (lg and up): a fixed left sidebar with the brand, the primary
 * "Post a ride" action, the three destinations and the signed-in user. The bottom nav is
 * hidden at this size. Rendered once by the signed-in layout.
 */
export function Sidebar() {
  const path = usePathname();
  const openCreate = useStore((s) => s.openCreate);
  const me = useStore((s) => s.me);
  // A ride page belongs to "My rides" as far as the sidebar is concerned.
  const current = activeTab(path) ?? (path.startsWith("/pool/") ? "rides" : null);
  return (
    <aside
      aria-label="Sidebar"
      className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w)] flex-col border-r border-line bg-surface px-5 pb-6 pt-7 lg:flex"
    >
      <Link href={ROUTES.home} className="flex items-center gap-3 rounded-inner px-2 py-1 outline-offset-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-dark text-accent" aria-hidden>
          <CarTaxiFront size={24} strokeWidth={1.75} />
        </span>
        <span className="leading-tight">
          <span className="block text-lg font-semibold tracking-tight">TravelTrack Beta</span>
          <span className="block text-label text-ink3">Plaksha Rides</span>
        </span>
      </Link>

      <motion.button
        type="button"
        onClick={() => {
          haptic(10);
          openCreate();
        }}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        transition={SPRING}
        className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-accentInk shadow-glow"
      >
        <Plus size={20} strokeWidth={2.2} aria-hidden />
        Post a ride
      </motion.button>

      <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = current === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-12 items-center gap-3 rounded-full px-4 text-[15px] font-medium transition-colors duration-200",
                active ? "text-ink" : "text-ink2 hover:text-ink",
              )}
            >
              {active && <motion.span layoutId="side-pill" transition={SPRING} className="absolute inset-0 rounded-full bg-soft" />}
              <Icon size={20} strokeWidth={active ? 2.1 : 1.75} className="relative" aria-hidden />
              <span className="relative">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {me && (
        <Link
          href={ROUTES.profile}
          className="flex items-center gap-3 rounded-inner bg-soft p-3 transition-colors hover:bg-soft/70"
        >
          <Avatar name={me.name} seed={me.id} src={me.avatar_url} size="md" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">{me.name}</span>
            <span className="block truncate text-label text-ink3">{me.email}</span>
          </span>
        </Link>
      )}
    </aside>
  );
}

export interface AppShellProps {
  children: ReactNode;
  /** Rendered above the content inside the column, already padded for the status bar. Use <PageHeader> or your own row. */
  header?: ReactNode;
  /** Leave room for the floating bottom nav (the layout shows it on tab routes). Default true; pass false on focused pages (ride page) that use `bottomBar`. */
  nav?: boolean;
  /**
   * A sticky action bar pinned to the bottom of the screen (above the nav when both show).
   * It sits in the page flow, so content is never hidden behind it. It is frosted and padded for the safe area.
   */
  bottomBar?: ReactNode;
  /** Backdrop of the page: "canvas" (default) or "dark" (ride page: dark area behind a light ticket). */
  tone?: "canvas" | "dark";
  /** Classes for the <main> element (default: "px-5"). */
  className?: string;
}

/**
 * The column every signed-in screen lives in: phone width (max 440px) on small screens, and at
 * lg and up a wide content area (max 1180px) beside the sidebar. Safe-area aware, with the page transition. The auth gate, the floating nav and the create
 * wizard live in app/(app)/layout.tsx so they persist between screens.
 *
 *   <AppShell header={<PageHeader title="My rides" />}>...</AppShell>
 */
export function AppShell({ children, header, nav = true, bottomBar, tone = "canvas", className }: AppShellProps) {
  return (
    <div
      className={cn(
        "relative mx-auto flex min-h-dvh w-full max-w-phone flex-col lg:max-w-[1180px]",
        tone === "dark" ? "bg-dark text-ondark lg:my-6 lg:min-h-[calc(100dvh-3rem)] lg:rounded-[32px]" : "bg-canvas text-ink",
      )}
    >
      {header != null && <header className="pt-safe shrink-0 px-5 lg:px-10 lg:pt-8">{header}</header>}
      <main
        className={cn(
          "min-w-0 flex-1",
          header == null && "pt-safe lg:pt-8",
          // With a bottom bar the bar itself reserves the space; otherwise pad for the nav.
          bottomBar == null && (nav ? "pb-nav" : "pb-safe"),
          bottomBar != null && "pb-5",
          className ?? "px-5 lg:px-10",
        )}
      >
        <PageTransition>{children}</PageTransition>
      </main>
      {bottomBar != null && (
        <motion.div
          className={cn("sticky z-30 shrink-0", nav && "pb-3")}
          style={{ bottom: nav ? "calc(var(--nav-h) + var(--nav-gap))" : 0 }}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={SPRING}
        >
          {/* The background covers the safe-area padding too, so nothing shows through under the button. */}
          <div
            className={cn(
              "px-5 pt-3 lg:rounded-b-[32px] lg:px-10",
              !nav && "pb-safe",
              !nav && (tone === "dark" ? "bg-dark/85 backdrop-blur-xl" : "frost border-t border-line"),
            )}
          >
            <div className="lg:mx-auto lg:max-w-lg">{bottomBar}</div>
          </div>
        </motion.div>
      )}
      {nav && bottomBar != null && <div className="h-nav shrink-0" aria-hidden />}
    </div>
  );
}

export interface PageHeaderProps {
  /** Big page title (h1), e.g. "Find a ride". */
  title?: ReactNode;
  /** Small line above the title, e.g. "Hey, Kavish". */
  eyebrow?: ReactNode;
  /** Left of the eyebrow/title row: an Avatar or a back IconButton. */
  leading?: ReactNode;
  /** Right side: one or two IconButtons. */
  trailing?: ReactNode;
  /** Centred small title instead of the big one (ride page / sub-pages, like "Upcoming Trips" in the reference). */
  compact?: boolean;
  className?: string;
}

/** Standard page header for AppShell's `header` slot. */
export function PageHeader({ title, eyebrow, leading, trailing, compact = false, className }: PageHeaderProps) {
  if (compact) {
    return (
      <div className={cn("grid h-14 grid-cols-[44px_1fr_44px] items-center gap-2", className)}>
        <div className="flex justify-start">{leading}</div>
        <h1 className="truncate text-center text-base font-semibold">{title}</h1>
        <div className="flex justify-end">{trailing}</div>
      </div>
    );
  }
  return (
    <div className={cn("pb-1", className)}>
      {(leading != null || eyebrow != null || trailing != null) && (
        <div className="flex min-h-14 items-center gap-3">
          {leading}
          <div className="min-w-0 flex-1">{eyebrow != null && <p className="truncate text-sm opacity-70">{eyebrow}</p>}</div>
          {trailing != null && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
        </div>
      )}
      {title != null && <h1 className="title mt-2">{title}</h1>}
    </div>
  );
}
