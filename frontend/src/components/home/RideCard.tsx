"use client";

import { Check, ChevronRight, MessageCircle, Plus, TrainFront, Plane } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import {
  AnimatedNumber,
  AvatarStack,
  Badge,
  Button,
  Card,
  Countdown,
  IconButton,
  RouteLine,
  SeatDots,
  SPRING,
  VehicleIcon,
} from "@/components/ui";
import { ROUTES } from "@/components/ui/AppShell";
import { firstName } from "@/lib/names";
import { cn } from "@/lib/cn";
import { shortPlaceName } from "@/lib/geo";
import { isMember, mySeats } from "@/lib/pools";
import { dayLabel, hhmm } from "@/lib/time";
import type { Pool, Preset } from "@/lib/types";
import { vehicleLabel } from "@/lib/vehicles";

export interface RideCardProps {
  pool: Pool;
  /** From useNow(), so every countdown ticks together. */
  now: number;
  meId: string;
  presets: Preset[];
  /** The dark feature card (soonest ride). */
  featured?: boolean;
  /** "board" offers Join; "mine" (My rides) shows my seats and the ride status. */
  context?: "board" | "mine";
  /** Opens the seat-count sheet. */
  onJoin?: (pool: Pool) => void;
  /** Dims a ride that is already over (My rides, earlier section). */
  past?: boolean;
}

function ridersLine(pool: Pool, meId: string): string {
  const others = pool.members.filter((m) => m.user.id !== meId).map((m) => firstName(m.user.name));
  const iAmIn = others.length !== pool.members.length;
  if (iAmIn) {
    if (others.length === 0) return "Just you so far";
    if (others.length === 1) return `You and ${others[0]}`;
    return `You, ${others[0]} +${others.length - 1}`;
  }
  if (others.length === 0) return "No riders yet";
  if (others.length === 1) return others[0]!;
  return `${others[0]} +${others.length - 1}`;
}

/**
 * A ride on the board: the departure window at the two ends of a RouteLine, place names
 * beneath, then vehicle, seats, riders and the action. The whole card opens the ride page;
 * the action buttons sit above that link.
 */
export function RideCard({ pool, now, meId, presets, featured = false, context = "board", onJoin, past = false }: RideCardProps) {
  const [pressed, setPressed] = useState(false);
  const tone = featured ? "dark" : "light";
  const member = isMember(pool, meId);
  const seats = mySeats(pool, meId);
  const total = pool.seats_taken + pool.seats_open;
  const from = shortPlaceName(pool.origin, presets);
  const to = shortPlaceName(pool.destination, presets);
  const joinable = !member && pool.status === "open" && pool.seats_open > 0;
  const booked = pool.status === "booked" || pool.status === "departed";
  const release = () => setPressed(false);

  const transit =
    pool.transit_mode !== "none" && pool.transit_code ? (
      <Badge
        size="sm"
        tone={featured ? "onDark" : "neutral"}
        icon={
          pool.transit_mode === "flight" ? (
            <Plane size={12} strokeWidth={1.75} aria-hidden />
          ) : (
            <TrainFront size={12} strokeWidth={1.75} aria-hidden />
          )
        }
      >
        {pool.transit_code}
      </Badge>
    ) : null;

  let seatsNote: React.ReactNode;
  if (context === "mine") {
    seatsNote = (
      <span className={cn("tnum text-label", featured ? "text-ondark2" : "text-ink2")}>
        {seats === 1 ? "Your seat" : `Your ${seats} seats`} · {pool.seats_taken}/{total} taken
      </span>
    );
  } else if (pool.seats_open === 0) {
    seatsNote = <span className={cn("text-label", featured ? "text-ondark2" : "text-ink3")}>Full</span>;
  } else if (pool.seats_open === 1) {
    seatsNote = (
      <Badge tone="warn" size="sm">
        1 seat left
      </Badge>
    );
  } else {
    seatsNote = (
      <span className={cn("tnum text-label", featured ? "text-ondark2" : "text-ink2")}>
        <AnimatedNumber value={pool.seats_open} /> seats left
      </span>
    );
  }

  let action: React.ReactNode;
  if (context === "mine") {
    action = (
      <div className="pointer-events-auto flex shrink-0 items-center gap-2">
        {pool.contact_url && (
          <IconButton label="Open the ride's WhatsApp chat" href={pool.contact_url} variant={featured ? "onDark" : "soft"}>
            <MessageCircle size={20} strokeWidth={1.75} aria-hidden />
          </IconButton>
        )}
        <Button
          size="sm"
          variant={featured ? "primary" : "soft"}
          href={ROUTES.pool(pool.id)}
          iconRight={<ChevronRight size={16} strokeWidth={1.75} aria-hidden />}
        >
          {pool.status === "booked" ? "Split" : "Open"}
        </Button>
      </div>
    );
  } else if (member) {
    action = (
      <div className="pointer-events-auto flex shrink-0 items-center gap-2">
        <Badge tone={featured ? "accentSolid" : "accent"} icon={<Check size={14} strokeWidth={2} aria-hidden />}>
          You&apos;re in
        </Badge>
        {pool.contact_url && (
          <IconButton label="Open the ride's WhatsApp chat" href={pool.contact_url} variant={featured ? "onDark" : "soft"}>
            <MessageCircle size={20} strokeWidth={1.75} aria-hidden />
          </IconButton>
        )}
      </div>
    );
  } else if (joinable) {
    action = (
      <Button
        size="sm"
        variant={featured ? "primary" : "dark"}
        className="pointer-events-auto shrink-0"
        icon={<Plus size={16} strokeWidth={2} aria-hidden />}
        aria-label={`Join the ${hhmm(pool.window_start)} ride from ${from} to ${to}`}
        onClick={() => onJoin?.(pool)}
      >
        Join
      </Button>
    );
  } else {
    action = (
      <Badge tone={featured ? "onDark" : "neutral"}>{pool.status === "full" || pool.status === "open" ? "Full" : "Booked"}</Badge>
    );
  }

  return (
    <motion.div animate={{ scale: pressed ? 0.97 : 1, opacity: past ? 0.62 : 1 }} transition={SPRING}>
      <Card tone={featured ? "dark" : "surface"} pad="none" className="overflow-hidden">
        <Link
          href={ROUTES.pool(pool.id)}
          className="absolute inset-0 z-0 rounded-card"
          aria-label={`${dayLabel(pool.window_start)} ${hhmm(pool.window_start)}, ${from} to ${to}. Open ride`}
          onPointerDown={() => setPressed(true)}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
        />

        <div className="pointer-events-none relative z-10 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn("truncate text-label font-medium", featured ? "text-ondark2" : "text-ink2")}>
                {dayLabel(pool.window_start)}
              </span>
              {transit}
              {context === "mine" && booked && (
                <Badge size="sm" tone="accentSolid" icon={<Check size={12} strokeWidth={2} aria-hidden />}>
                  Booked
                </Badge>
              )}
              {context === "mine" && pool.creator.id === meId && !booked && (
                <Badge size="sm" tone={featured ? "onDark" : "neutral"}>
                  Posted by you
                </Badge>
              )}
            </div>
            {past ? (
              <span className="text-label text-ink3">Done</span>
            ) : (
              <Countdown iso={pool.window_start} now={now} tone={tone} size="sm" />
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className={cn("tnum font-semibold", featured ? "text-2xl" : "text-xl")}>{hhmm(pool.window_start)}</span>
            <div className="min-w-0 flex-1">
              <RouteLine tone={tone} vehicle={pool.vehicle} size={featured ? "md" : "sm"} />
            </div>
            <span className={cn("tnum font-semibold", featured ? "text-2xl" : "text-xl")}>{hhmm(pool.window_end)}</span>
          </div>

          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <span className={cn("truncate text-sm", featured ? "text-ondark" : "text-ink")}>{from}</span>
            <span
              className={cn(
                "tnum rounded-full px-2 py-0.5 text-2xs",
                featured ? "bg-white/10 text-ondark2" : "bg-soft text-ink3",
              )}
            >
              {pool.distance_km} km
            </span>
            <span className={cn("truncate text-right text-sm", featured ? "text-ondark" : "text-ink")}>{to}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge
              tone={featured ? "onDark" : "neutral"}
              icon={<VehicleIcon vehicle={pool.vehicle} size={14} aria-hidden />}
            >
              {vehicleLabel(pool.vehicle)}
            </Badge>
            <SeatDots taken={pool.seats_taken} total={total} tone={tone} size="sm" />
            {seatsNote}
          </div>

          <div
            className={cn(
              "mt-4 flex min-h-11 items-center justify-between gap-3",
              featured ? "-mx-1 rounded-inner bg-white/5 py-2 pl-3 pr-2" : "border-t border-dashed border-line pt-3",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <AvatarStack users={pool.members.map((m) => m.user)} max={3} ring={featured ? "dark" : "surface"} />
              <span className={cn("truncate text-label", featured ? "text-ondark2" : "text-ink2")}>
                {ridersLine(pool, meId)}
              </span>
            </div>
            {action}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
