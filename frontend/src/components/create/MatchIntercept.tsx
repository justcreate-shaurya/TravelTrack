"use client";

import { MapPin, Plane, Sparkles, TrainFront } from "lucide-react";

import {
  AnimatedNumber,
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Card,
  FadeIn,
  RouteLine,
  SeatDots,
  Stagger,
  StaggerItem,
  VehicleIcon,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMeters, shortPlaceName } from "@/lib/geo";
import { firstName } from "@/lib/names";
import { dayLabel, hhmm } from "@/lib/time";
import type { Match, Preset } from "@/lib/types";
import { vehicleLabel } from "@/lib/vehicles";

export interface MatchInterceptProps {
  /** The ready-made sentence from the server's 409. */
  message: string;
  matches: Match[];
  presets: Preset[];
  /** Seats the form asked for; joining takes this many. */
  seats: number;
  /** Id of the ride being joined right now, if any. */
  joiningId: string | null;
  /** Blocks every action (a join or a forced post is in flight). */
  busy: boolean;
  onJoin: (match: Match) => void;
}

/** Shown instead of posting when someone nearby is already going the same way. */
export function MatchIntercept({ message, matches, presets, seats, joiningId, busy, onJoin }: MatchInterceptProps) {
  return (
    <div className="space-y-4 pb-6 pt-1">
      <FadeIn>
        <div className="flex items-start gap-3 rounded-inner bg-warn p-4 text-warnInk" role="status">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warnInk/10" aria-hidden>
            <Sparkles size={20} strokeWidth={1.75} />
          </span>
          <p className="min-w-0 text-[15px] font-medium leading-snug">{message}</p>
        </div>
      </FadeIn>

      <Stagger as="ul" className="space-y-3">
        {matches.map((m, i) => (
          <StaggerItem as="li" key={m.pool.id}>
            <MatchCard
              match={m}
              presets={presets}
              seats={seats}
              featured={i === 0}
              joining={joiningId === m.pool.id}
              busy={busy}
              onJoin={() => onJoin(m)}
            />
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

function MatchCard({
  match,
  presets,
  seats,
  featured,
  joining,
  busy,
  onJoin,
}: {
  match: Match;
  presets: Preset[];
  seats: number;
  featured: boolean;
  joining: boolean;
  busy: boolean;
  onJoin: () => void;
}) {
  const { pool } = match;
  const first = firstName(pool.creator.name);
  const enough = pool.seats_open >= seats;
  const sub = featured ? "text-ondark2" : "text-ink3";
  const badge = featured ? "onDark" : "neutral";

  return (
    <Card tone={featured ? "dark" : "surface"} pad="sm" className={cn(!featured && "border border-line")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={pool.creator.name} seed={pool.creator.id} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5">{first}&apos;s ride</p>
            <p className={cn("truncate text-2xs", sub)}>{dayLabel(pool.window_start)}</p>
          </div>
        </div>
        <Badge tone={featured ? "accentSolid" : "accent"} icon={<MapPin size={13} strokeWidth={1.75} />}>
          {formatMeters(match.origin_distance_m)} from your pickup
        </Badge>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="tnum text-xl font-semibold">{hhmm(pool.window_start)}</span>
        <RouteLine tone={featured ? "dark" : "light"} vehicle={pool.vehicle} delay={0.15} />
        <span className="tnum text-xl font-semibold">{hhmm(pool.window_end)}</span>
      </div>
      <div className={cn("mt-1 flex justify-between gap-4 text-label", sub)}>
        <span className="min-w-0 truncate">{shortPlaceName(pool.origin, presets)}</span>
        <span className="min-w-0 truncate text-right">{shortPlaceName(pool.destination, presets)}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={badge} icon={<VehicleIcon vehicle={pool.vehicle} size={14} />}>
          {vehicleLabel(pool.vehicle)}
        </Badge>
        {match.same_transit && pool.transit_code && (
          <Badge
            tone={badge}
            icon={
              pool.transit_mode === "flight" ? <Plane size={13} strokeWidth={1.75} /> : <TrainFront size={13} strokeWidth={1.75} />
            }
          >
            Same {pool.transit_mode === "flight" ? "flight" : "train"}
          </Badge>
        )}
        {match.destination_distance_m > 150 && (
          <Badge tone={badge}>Drops {formatMeters(match.destination_distance_m)} from yours</Badge>
        )}
      </div>

      <div className={cn("mt-4 flex items-center justify-between gap-3 border-t pt-3", featured ? "border-darkline" : "border-line")}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SeatDots taken={pool.seats_taken} total={pool.seats_taken + pool.seats_open} tone={featured ? "dark" : "light"} size="sm" />
            <AvatarStack users={pool.members.map((m) => m.user)} max={3} size="xs" ring={featured ? "dark" : "surface"} />
          </div>
          <p className={cn("mt-1 text-label", sub)}>
            <AnimatedNumber value={pool.seats_open} /> {pool.seats_open === 1 ? "seat" : "seats"} open
          </p>
        </div>
        <Button size="sm" className="shrink-0 px-5" loading={joining} disabled={busy || !enough} onClick={onJoin}>
          {!enough ? `Needs ${seats} seats` : seats > 1 ? `Join with ${seats}` : "Join"}
        </Button>
      </div>
    </Card>
  );
}
