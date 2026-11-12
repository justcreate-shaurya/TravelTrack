"use client";

import { ChevronRight, LocateFixed, MapPin, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";

import { Button, Card, IconButton, Pill, SPRING } from "@/components/ui";
import { ROUTES } from "@/components/ui/AppShell";
import { formatDistance, shortPlaceName } from "@/lib/geo";
import type { NearbyPool } from "@/lib/pools";
import { hhmm } from "@/lib/time";
import type { Pool, Preset } from "@/lib/types";
import type { GeoStatus } from "@/lib/useGeolocation";

export interface NearYouProps {
  status: GeoStatus;
  hasLocation: boolean;
  locating: boolean;
  /** Nearby rides not dismissed, closest first. */
  near: NearbyPool[];
  radiusKm: number;
  presets: Preset[];
  /** Ask for the device position. Only ever called from a tap. */
  onLocate: () => void;
  onJoin: (pool: Pool) => void;
  onDismiss: () => void;
  /** Start a ride with the current spot as the pickup. */
  onPostFromHere: () => void;
  postingFromHere: boolean;
}

const MAX_ROWS = 3;

/**
 * The "Near you" block: the warn-yellow prompt when rides are leaving close to the device,
 * a quiet chip to turn location on, or a quiet line when nothing is nearby.
 */
export function NearYou({
  status,
  hasLocation,
  locating,
  near,
  radiusKm,
  presets,
  onLocate,
  onJoin,
  onDismiss,
  onPostFromHere,
  postingFromHere,
}: NearYouProps) {
  if (status === "unsupported") return null;

  let content: React.ReactNode = null;
  let key = "none";

  if (!hasLocation) {
    key = "ask";
    content = (
      <Pill
        icon={<LocateFixed size={18} strokeWidth={1.75} aria-hidden />}
        onClick={onLocate}
        disabled={locating}
      >
        {locating ? "Finding you…" : "Show rides near me"}
      </Pill>
    );
  } else if (near.length > 0) {
    key = "near";
    const rows = near.slice(0, MAX_ROWS);
    const extra = near.length - rows.length;
    content = (
      <Card tone="warn" pad="sm" aria-label="Rides near you">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-warnInk/10">
            <MapPin size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-tight">
              {near.length === 1 ? "A ride is leaving near you" : `${near.length} rides leaving near you`}
            </p>
            <p className="text-label opacity-75">Pickup within {formatDistance(radiusKm)} · next 3 hours</p>
          </div>
          <IconButton label="Hide rides near you" variant="ghost" className="!text-warnInk" onClick={onDismiss}>
            <X size={20} strokeWidth={1.75} aria-hidden />
          </IconButton>
        </div>

        <ul className="mt-3 space-y-2">
          <AnimatePresence initial={false}>
            {rows.map(({ pool, distanceKm }) => (
              <motion.li
                key={pool.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={SPRING}
                className="flex items-center gap-2 rounded-inner bg-warnInk/10 py-2 pl-4 pr-2"
              >
                <Link
                  href={ROUTES.pool(pool.id)}
                  className="press flex min-h-11 min-w-0 flex-1 items-center gap-3"
                  aria-label={`${hhmm(pool.window_start)} ride to ${pool.destination.name}, pickup ${formatDistance(distanceKm)} away. Open ride`}
                >
                  <span className="tnum text-lg font-semibold">{hhmm(pool.window_start)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      To {shortPlaceName(pool.destination, presets)}
                    </span>
                    <span className="tnum block truncate text-label opacity-75">
                      {formatDistance(distanceKm)} away · {pool.seats_open === 1 ? "1 seat left" : `${pool.seats_open} seats left`}
                    </span>
                  </span>
                </Link>
                <Button
                  size="sm"
                  variant="dark"
                  icon={<Plus size={16} strokeWidth={2} aria-hidden />}
                  aria-label={`Join the ${hhmm(pool.window_start)} ride to ${pool.destination.name}`}
                  onClick={() => onJoin(pool)}
                >
                  Join
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {extra > 0 && (
          <p className="mt-2 flex items-center gap-1 text-label opacity-75">
            +{extra} more in the list below <ChevronRight size={14} strokeWidth={1.75} aria-hidden />
          </p>
        )}
      </Card>
    );
  } else if (status === "granted" || hasLocation) {
    key = "quiet";
    content = (
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-label text-ink3">
          <MapPin size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />
          <span>No rides leaving near you in the next 3 hours</span>
        </p>
        <Button size="sm" variant="soft" className="shrink-0" loading={postingFromHere} onClick={onPostFromHere}>
          Post from here
        </Button>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {content && (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={SPRING}
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
