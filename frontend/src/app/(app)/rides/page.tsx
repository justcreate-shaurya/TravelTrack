"use client";

import { CloudOff, Plus, RotateCw, Search, Ticket } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";

import { RideCard } from "@/components/home/RideCard";
import { Button, EmptyState, RideCardSkeleton, SkeletonList, Stagger, StaggerItem } from "@/components/ui";
import { AppShell, PageHeader, ROUTES } from "@/components/ui/AppShell";
import { isMember, sortPools } from "@/lib/pools";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/useNow";

export default function MyRidesPage() {
  const now = useNow();
  const me = useStore((s) => s.me)!;
  const poolsById = useStore((s) => s.pools);
  const loaded = useStore((s) => s.loaded);
  const loadError = useStore((s) => s.loadError);
  const presets = useStore((s) => s.presets);
  const refreshPools = useStore((s) => s.refreshPools);
  const showToast = useStore((s) => s.showToast);
  const openCreate = useStore((s) => s.openCreate);

  const load = useCallback(() => {
    // With nothing loaded yet the retry state below covers it; otherwise a toast is enough.
    refreshPools().catch(() => {
      if (useStore.getState().loaded) showToast("Couldn't refresh your rides", "error", { label: "Retry", onClick: load });
    });
  }, [refreshPools, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const { upcoming, earlier } = useMemo(() => {
    const mine = sortPools(Object.values(poolsById).filter((p) => isMember(p, me.id)));
    const isOver = (end: string, status: string) => status === "departed" || new Date(end).getTime() < now;
    return {
      upcoming: mine.filter((p) => !isOver(p.window_end, p.status)),
      // Most recent first.
      earlier: mine.filter((p) => isOver(p.window_end, p.status)).reverse(),
    };
  }, [poolsById, me.id, now]);

  const booked = upcoming.filter((p) => p.status === "booked").length;
  const summary = !loaded
    ? loadError
      ? "Couldn't load your rides"
      : "Loading your rides"
    : upcoming.length === 0
      ? "Nothing coming up"
      : `${upcoming.length} coming up${booked > 0 ? ` · ${booked} booked` : ""}`;

  return (
    <AppShell header={<PageHeader title="My rides" />}>
      <div className="space-y-4 pb-6 pt-1 lg:pt-3">
        <p className="tnum text-sm text-ink2" role="status">
          {summary}
        </p>

        {!loaded && loadError ? (
          <EmptyState
            icon={<CloudOff size={26} strokeWidth={1.75} aria-hidden />}
            title="Couldn't load your rides"
            body="Check your connection and try again."
            action={
              <Button icon={<RotateCw size={18} strokeWidth={1.75} aria-hidden />} onClick={load}>
                Try again
              </Button>
            }
          />
        ) : !loaded ? (
          <SkeletonList label="Loading your rides">
            <RideCardSkeleton tone="dark" />
            <RideCardSkeleton />
          </SkeletonList>
        ) : upcoming.length === 0 && earlier.length === 0 ? (
          <EmptyState
            icon={<Ticket size={26} strokeWidth={1.75} aria-hidden />}
            title="You're not in any ride yet"
            body="Join one that's heading your way, or post your own from anywhere to anywhere."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="soft" href={ROUTES.home} icon={<Search size={18} strokeWidth={1.75} aria-hidden />}>
                  Find a ride
                </Button>
                <Button icon={<Plus size={18} strokeWidth={2} aria-hidden />} onClick={() => openCreate()}>
                  Post a ride
                </Button>
              </div>
            }
          />
        ) : (
          <>
            {upcoming.length === 0 ? (
              <EmptyState
                variant="plain"
                icon={<Ticket size={26} strokeWidth={1.75} aria-hidden />}
                title="Nothing coming up"
                body="Your earlier rides are below."
                action={
                  <Button icon={<Plus size={18} strokeWidth={2} aria-hidden />} onClick={() => openCreate()}>
                    Post a ride
                  </Button>
                }
              />
            ) : (
              <section aria-label="Upcoming rides">
                <h2 className="mb-3 text-xl font-semibold">Up next</h2>
                <Stagger className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                  {upcoming.map((p, i) => (
                    <StaggerItem key={p.id} className={i === 0 ? "lg:col-span-2" : undefined}>
                      <RideCard pool={p} now={now} meId={me.id} presets={presets} context="mine" featured={i === 0} />
                    </StaggerItem>
                  ))}
                </Stagger>
              </section>
            )}

            {earlier.length > 0 && (
              <section aria-label="Earlier rides">
                <h2 className="mb-3 mt-6 text-xl font-semibold">Earlier</h2>
                <Stagger className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                  {earlier.map((p) => (
                    <StaggerItem key={p.id}>
                      <RideCard pool={p} now={now} meId={me.id} presets={presets} context="mine" past />
                    </StaggerItem>
                  ))}
                </Stagger>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
