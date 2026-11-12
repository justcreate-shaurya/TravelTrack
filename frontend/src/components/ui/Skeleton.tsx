import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface SkeletonProps {
  /** Size and radius via classes, e.g. "h-4 w-24 rounded-full" or "h-40 rounded-card". */
  className?: string;
}

/** A shimmering placeholder block. */
export function Skeleton({ className }: SkeletonProps) {
  return <span className={cn("skeleton block rounded-full", className)} aria-hidden />;
}

/** Placeholder shaped like a ride card (time / route line / time, names, footer row). */
export function RideCardSkeleton({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <div
      className={cn("rounded-card p-5", tone === "dark" ? "on-dark bg-dark" : "bg-surface shadow-card")}
      aria-hidden
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-14" />
        <Skeleton className="h-1.5 flex-1" />
        <Skeleton className="h-6 w-14" />
      </div>
      <div className="mt-3 flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}

/** Wraps loading content and announces it to screen readers. */
export function SkeletonList({ children, label = "Loading" }: { children: ReactNode; label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="space-y-3">
      {children}
    </div>
  );
}
