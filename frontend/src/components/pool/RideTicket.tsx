"use client";

import { MapPin, Plane, TrainFront, Users } from "lucide-react";
import type { ReactNode } from "react";

import { AnimatedNumber, Avatar, AvatarStack, Badge, RouteLine, SeatDots, Skeleton, TicketCard, VehicleIcon } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { formatDistance, shortPlaceName } from "@/lib/geo";
import { durationLabel, hhmm, windowMinutes } from "@/lib/time";
import type { PoolDetail, PoolStatus, Preset } from "@/lib/types";
import { vehicleLabel } from "@/lib/vehicles";

import { rideCode, STATUS_LABEL } from "./util";

const STATUS_TONE: Record<PoolStatus, BadgeTone> = {
  open: "accent",
  full: "warn",
  booked: "dark",
  departed: "neutral",
};

function Detail({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="label flex items-center gap-1">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-[15px] font-semibold leading-5 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** The ride as a ticket: who posted it, the time window on a route line, details, and a seat stub. */
export function RideTicket({ pool, presets }: { pool: PoolDetail; presets: Preset[] }) {
  const total = pool.seats_taken + pool.seats_open;
  const from = shortPlaceName(pool.origin, presets);
  const to = shortPlaceName(pool.destination, presets);
  const riders = pool.members.length;
  const TransitIcon = pool.transit_mode === "flight" ? Plane : TrainFront;

  return (
    <TicketCard
      tone="light"
      bodyClassName="p-5 pb-4"
      stubClassName="px-5 pb-5 pt-2"
      stub={
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="label">Seats</p>
            <p className="mt-0.5 text-2xl font-semibold leading-8">
              {pool.seats_open > 0 ? (
                <>
                  <AnimatedNumber value={pool.seats_open} /> <span className="text-base font-medium text-ink2">of {total} open</span>
                </>
              ) : (
                <span>All {total} taken</span>
              )}
            </p>
            <SeatDots taken={pool.seats_taken} total={total} size="lg" className="mt-2 flex-wrap" />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <AvatarStack users={pool.members.map((m) => m.user)} max={4} size="sm" ring="surface" />
            <span className="tnum text-label text-ink3">
              {riders} rider{riders === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      }
    >
      {/* Posted by + status */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={pool.creator.name} seed={pool.creator.id} size="md" />
          <div className="min-w-0">
            <p className="label">Posted by</p>
            <p className="truncate text-lg font-semibold leading-6">{pool.creator.name}</p>
          </div>
        </div>
        <Badge tone={STATUS_TONE[pool.status]} icon={<Users size={13} strokeWidth={1.75} aria-hidden />}>
          {STATUS_LABEL[pool.status]}
        </Badge>
      </div>

      {/* Time window on the route */}
      <div className="mt-6">
        <div className="tnum flex items-baseline justify-between gap-2">
          <span className="text-[28px] font-semibold leading-8">{hhmm(pool.window_start)}</span>
          <span className="text-label font-medium text-ink2">{durationLabel(windowMinutes(pool.window_start, pool.window_end))} window</span>
          <span className="text-[28px] font-semibold leading-8">{hhmm(pool.window_end)}</span>
        </div>
        <RouteLine vehicle={pool.vehicle} animate="loop" size="md" className="mt-2" delay={0.15} />
        <div className="mt-2 grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-6 [overflow-wrap:anywhere]">{from}</p>
            {from !== pool.origin.name && <p className="mt-0.5 text-label text-ink3 [overflow-wrap:anywhere]">{pool.origin.name}</p>}
          </div>
          <div className="min-w-0 text-right">
            <p className="text-lg font-semibold leading-6 [overflow-wrap:anywhere]">{to}</p>
            {to !== pool.destination.name && <p className="mt-0.5 text-label text-ink3 [overflow-wrap:anywhere]">{pool.destination.name}</p>}
          </div>
        </div>
      </div>

      {/* Ride code */}
      <div className="mt-6 flex items-end justify-between gap-3">
        <div>
          <p className="label">Ride code</p>
          <p className="tnum mt-0.5 text-2xl font-semibold leading-8">{rideCode(pool.id)}</p>
        </div>
        <Badge tone="neutral">{formatDistance(pool.distance_km)}</Badge>
      </div>

      {/* Details */}
      <dl className="mt-5 grid grid-cols-3 gap-3">
        <Detail label="Pickup" icon={<MapPin size={13} strokeWidth={1.75} aria-hidden />}>
          {pool.meeting_point}
        </Detail>
        <Detail label="Vehicle" icon={<VehicleIcon vehicle={pool.vehicle} size={13} />}>
          {vehicleLabel(pool.vehicle)}
        </Detail>
        <Detail label="Seats" icon={<Users size={13} strokeWidth={1.75} aria-hidden />}>
          <span className="tnum">
            {pool.seats_taken}/{total}
          </span>
        </Detail>
      </dl>

      {(pool.transit_code || pool.custom_route_note) && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-inner bg-soft p-3">
          {pool.transit_code && (
            <Badge tone="dark" icon={<TransitIcon size={13} strokeWidth={1.75} aria-hidden />}>
              {pool.transit_code}
              {pool.transit_time ? ` · ${hhmm(pool.transit_time)}` : ""}
            </Badge>
          )}
          {pool.custom_route_note && <p className="min-w-0 flex-1 text-sm text-ink2 [overflow-wrap:anywhere]">{pool.custom_route_note}</p>}
        </div>
      )}
    </TicketCard>
  );
}

/** Loading placeholder shaped like the ticket. */
export function RideTicketSkeleton() {
  return (
    <div className="rounded-card bg-surface p-5" role="status" aria-busy="true" aria-label="Loading ride">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
      <div className="mt-7 flex items-center gap-3">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-1.5 flex-1" />
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="mt-4 flex justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="mt-8 grid grid-cols-3 gap-3">
        <Skeleton className="h-10 rounded-input" />
        <Skeleton className="h-10 rounded-input" />
        <Skeleton className="h-10 rounded-input" />
      </div>
      <Skeleton className="mt-8 h-14 rounded-inner" />
    </div>
  );
}
