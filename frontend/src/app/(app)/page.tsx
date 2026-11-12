"use client";

import { CarTaxiFront, CloudOff, LocateFixed, Plus, RotateCw, SearchX } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { JoinSheet } from "@/components/home/JoinSheet";
import { NearYou } from "@/components/home/NearYou";
import { RideCard } from "@/components/home/RideCard";
import {
  Avatar,
  Button,
  DateStrip,
  EmptyState,
  IconButton,
  Pill,
  RideCardSkeleton,
  SegmentedTabs,
  SkeletonList,
  Stagger,
  StaggerItem,
} from "@/components/ui";
import { AppShell, PageHeader } from "@/components/ui/AppShell";
import { cn } from "@/lib/cn";
import { deviceFixToPlace, formatDistance, shortPlaceName } from "@/lib/geo";
import { haptic } from "@/lib/haptics";
import { firstName } from "@/lib/names";
import { filterPools, nearbyPools } from "@/lib/pools";
import { useMatchRadiusKm, useStore, type DirectionFilter } from "@/lib/store";
import { dayLabel, hhmm } from "@/lib/time";
import type { Pool } from "@/lib/types";
import { useGeolocation } from "@/lib/useGeolocation";
import { useNow } from "@/lib/useNow";

export default function HomePage() {
  const now = useNow();
  const geo = useGeolocation();
  const radiusKm = useMatchRadiusKm();

  const me = useStore((s) => s.me)!;
  const poolsById = useStore((s) => s.pools);
  const loaded = useStore((s) => s.loaded);
  const loadError = useStore((s) => s.loadError);
  const live = useStore((s) => s.live);
  const filters = useStore((s) => s.filters);
  const presets = useStore((s) => s.presets);
  const setFilter = useStore((s) => s.setFilter);
  const resetFilters = useStore((s) => s.resetFilters);
  const refreshPools = useStore((s) => s.refreshPools);
  const showToast = useStore((s) => s.showToast);
  const openCreate = useStore((s) => s.openCreate);

  const [joinId, setJoinId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());

  // With nothing loaded yet a failure shows the retry state below; a failed refresh of a board
  // that is already on screen only needs a toast.
  const load = useCallback(() => {
    refreshPools().catch(() => {
      if (useStore.getState().loaded) showToast("Couldn't refresh rides", "error", { label: "Retry", onClick: load });
    });
  }, [refreshPools, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Rides whose window is over drop off the board (they stay under My rides).
  const all = useMemo(
    () =>
      Object.values(poolsById).filter(
        (p) => p.status !== "departed" && new Date(p.window_end).getTime() >= now,
      ),
    [poolsById, now],
  );
  const visible = useMemo(() => filterPools(all, filters, { presets, radiusKm }), [all, filters, presets, radiusKm]);
  const near = useMemo(
    () => nearbyPools(all, geo.location, { radiusKm, meId: me.id, now }),
    [all, geo.location, radiusKm, me.id, now],
  );
  const nearShown = useMemo(() => near.filter((n) => !dismissed.has(n.pool.id)), [near, dismissed]);

  // A ride that shows up nearby after the first look (posted live, or one that just came
  // into the 3 hour window) gets a toast with a Join action. Location stays on the device.
  const seenNear = useRef<Set<string> | null>(null);
  const hasLocation = geo.location !== null;
  useEffect(() => {
    if (!hasLocation || !loaded) {
      seenNear.current = null;
      return;
    }
    if (!seenNear.current) {
      seenNear.current = new Set(near.map((n) => n.pool.id));
      return;
    }
    const seen = seenNear.current;
    const fresh = near.filter((n) => !seen.has(n.pool.id));
    if (fresh.length === 0) return;
    for (const n of fresh) seen.add(n.pool.id);
    const { pool, distanceKm } = fresh[0]!;
    haptic();
    showToast(
      `New ride near you: ${hhmm(pool.window_start)} to ${shortPlaceName(pool.destination, presets)}, ${formatDistance(distanceKm)} away`,
      "info",
      { label: "Join", onClick: () => setJoinId(pool.id) },
    );
  }, [near, hasLocation, loaded, presets, showToast]);

  const locate = async () => {
    const loc = await geo.request();
    if (!loc) showToast("Couldn't get your location. Check that location is allowed for this site.", "error");
  };

  // Explicit action: the current spot becomes the pickup of a new ride. It is named on the
  // device (a preset, or "Current location"), so the raw fix is not sent to any server.
  const postFromHere = () => {
    const loc = geo.location;
    if (!loc) return;
    openCreate({ origin: deviceFixToPlace(presets, loc) });
  };

  // The sheet follows the live copy of the ride; it closes if the ride goes away.
  const joinPool: Pool | null = joinId ? (poolsById[joinId] ?? null) : null;

  const first = firstName(me.name);
  const filtered = filters.direction !== "all" || filters.day !== null || filters.placeKey !== null;
  const [featured, ...rest] = visible;

  return (
    <AppShell
      header={
        <PageHeader
          eyebrow={`Hey, ${first}`}
          title="Find a ride"
          leading={<Avatar name={me.name} seed={me.id} />}
          trailing={
            <IconButton
              label={hasLocation ? "Refresh rides near me" : "Show rides near me"}
              variant="surface"
              onClick={locate}
              disabled={geo.loading}
              dot={nearShown.length > 0}
            >
              <LocateFixed size={20} strokeWidth={1.75} aria-hidden />
            </IconButton>
          }
        />
      }
    >
      <div className="space-y-4 pb-6 pt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-x-10 lg:space-y-0 lg:pt-6">
        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
        <SegmentedTabs<DirectionFilter>
          label="Direction"
          value={filters.direction}
          onChange={(v) => setFilter("direction", v)}
          options={[
            { value: "all", label: "All" },
            { value: "out", label: "From Plaksha" },
            { value: "in", label: "To Plaksha" },
          ]}
        />

        {presets.length > 0 && (
          <div className="rail" role="group" aria-label="Filter by place">
            {presets.map((p) => (
              <Pill
                key={p.key}
                selected={filters.placeKey === p.key}
                onClick={() => setFilter("placeKey", filters.placeKey === p.key ? null : p.key)}
              >
                {p.short}
              </Pill>
            ))}
          </div>
        )}

        <DateStrip value={filters.day} onChange={(d) => setFilter("day", d)} allowNone />
        </div>

        {/* Mobile: sits between the filters and the list. Desktop: a sticky right rail. */}
        <div className="lg:sticky lg:top-8 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <NearYou
          status={geo.status}
          hasLocation={hasLocation}
          locating={geo.loading}
          near={nearShown}
          radiusKm={radiusKm}
          presets={presets}
          onLocate={locate}
          onJoin={(p) => setJoinId(p.id)}
          onDismiss={() => setDismissed(new Set(near.map((n) => n.pool.id)))}
          onPostFromHere={postFromHere}
          postingFromHere={false}
        />
        </div>

        <section aria-label="Rides" className="lg:col-start-1 lg:row-start-2 lg:mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">{featured ? "Leaving soonest" : "Rides"}</h2>
            <span className="flex items-center gap-1.5 text-label text-ink3" role="status">
              <span className={cn("h-2 w-2 rounded-full", live ? "bg-accent" : "bg-ink3/50")} aria-hidden />
              {live ? "Live" : "Connecting"}
            </span>
          </div>

          {!loaded && loadError ? (
            <EmptyState
              icon={<CloudOff size={26} strokeWidth={1.75} aria-hidden />}
              title="Couldn't load rides"
              body="Check your connection and try again."
              action={
                <Button icon={<RotateCw size={18} strokeWidth={1.75} aria-hidden />} onClick={load}>
                  Try again
                </Button>
              }
            />
          ) : !loaded ? (
            <SkeletonList label="Loading rides">
              <RideCardSkeleton tone="dark" />
              <RideCardSkeleton />
              <RideCardSkeleton />
            </SkeletonList>
          ) : !featured ? (
            filtered ? (
              <EmptyState
                icon={<SearchX size={26} strokeWidth={1.75} aria-hidden />}
                title="No rides match"
                body="Nothing for these filters yet. Clear them, or post the ride you need."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="soft" onClick={resetFilters}>
                      Clear filters
                    </Button>
                    <Button icon={<Plus size={18} strokeWidth={2} aria-hidden />} onClick={() => openCreate()}>
                      Post a ride
                    </Button>
                  </div>
                }
              />
            ) : (
              <EmptyState
                icon={<CarTaxiFront size={26} strokeWidth={1.75} aria-hidden />}
                title="No rides yet"
                body="Post one from anywhere to anywhere. People heading the same way nearby will be pointed to it."
                action={
                  <Button icon={<Plus size={18} strokeWidth={2} aria-hidden />} onClick={() => openCreate()}>
                    Post a ride
                  </Button>
                }
              />
            )
          ) : (
            <Stagger className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
              <StaggerItem key={featured.id} className="lg:col-span-2">
                <RideCard pool={featured} now={now} meId={me.id} presets={presets} featured onJoin={(p) => setJoinId(p.id)} />
              </StaggerItem>
              {rest.map((p, i) => {
                const day = dayLabel(p.window_start);
                const prev = i === 0 ? null : dayLabel(rest[i - 1]!.window_start);
                return (
                  <Fragment key={p.id}>
                    {day !== prev && (
                      <StaggerItem className="lg:col-span-2">
                        <h3 className={cn("-mb-1 px-1 text-label font-medium text-ink2", i === 0 ? "mt-2" : "mt-1", "lg:mb-0 lg:mt-2")}>
                          {i === 0 ? `More rides · ${day}` : day}
                        </h3>
                      </StaggerItem>
                    )}
                    <StaggerItem>
                      <RideCard pool={p} now={now} meId={me.id} presets={presets} onJoin={(q) => setJoinId(q.id)} />
                    </StaggerItem>
                  </Fragment>
                );
              })}
            </Stagger>
          )}
        </section>
      </div>

      <JoinSheet pool={joinPool} presets={presets} onClose={() => setJoinId(null)} />
    </AppShell>
  );
}
