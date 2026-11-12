"use client";

import { Users } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, RouteLine, Sheet, Stepper } from "@/components/ui";
import { shortPlaceName } from "@/lib/geo";
import { dayLabel, hhmm } from "@/lib/time";
import type { PoolDetail, Preset } from "@/lib/types";
import { MAX_PARTY_SEATS } from "@/lib/vehicles";

import { firstName, seatWord } from "./util";

export interface SeatsSheetProps {
  open: boolean;
  onClose: () => void;
  pool: PoolDetail;
  presets: Preset[];
  /** Seats the viewer already holds (0 = joining for the first time). */
  mine: number;
  busy: boolean;
  onConfirm: (seats: number) => void;
}

/** Join the ride, or change how many seats your group holds. */
export function SeatsSheet({ open, onClose, pool, presets, mine, busy, onConfirm }: SeatsSheetProps) {
  const joining = mine === 0;
  const max = Math.max(1, Math.min(MAX_PARTY_SEATS, pool.seats_open + mine));
  const [seats, setSeats] = useState(mine || 1);

  useEffect(() => {
    if (open) setSeats(mine || 1);
  }, [open, mine]);

  const value = Math.min(seats, max);
  const unchanged = !joining && value === mine;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title={joining ? "Join this ride" : "Your seats"}
      description={joining ? `${firstName(pool.creator.name)} and the others will see you right away.` : "Bringing someone along, or freeing a seat?"}
      footer={
        <Button full size="lg" loading={busy} disabled={unchanged} onClick={() => onConfirm(value)}>
          {joining ? `Join with ${seatWord(value)}` : unchanged ? "No change" : `Hold ${seatWord(value)}`}
        </Button>
      }
    >
      <div className="space-y-3 pb-5">
        <div className="rounded-inner bg-soft p-4">
          <p className="label">{dayLabel(pool.window_start)}</p>
          <div className="mt-1 flex items-center gap-3">
            <span className="tnum text-lg font-semibold">{hhmm(pool.window_start)}</span>
            <RouteLine vehicle={pool.vehicle} size="sm" />
            <span className="tnum text-lg font-semibold">{hhmm(pool.window_end)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-4 text-sm text-ink2">
            <span className="min-w-0 truncate">{shortPlaceName(pool.origin, presets)}</span>
            <span className="min-w-0 truncate text-right">{shortPlaceName(pool.destination, presets)}</span>
          </div>
        </div>
        <Stepper
          label="Seats"
          hint={max === 1 ? "Only one seat is open" : `Up to ${max} for your group`}
          icon={<Users size={18} strokeWidth={1.75} />}
          value={value}
          onChange={setSeats}
          min={1}
          max={max}
          unit="seats"
          disabled={busy}
        />
        <p className="px-1 text-label text-ink3">Meet at {pool.meeting_point}. The fare is split per seat once someone books.</p>
      </div>
    </Sheet>
  );
}
