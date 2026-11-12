"use client";

import { MapPin, Users } from "lucide-react";
import { useState } from "react";

import { Badge, Button, RouteLine, Sheet, Stepper, VehicleIcon } from "@/components/ui";
import { shortPlaceName } from "@/lib/geo";
import { useStore } from "@/lib/store";
import { dayLabel, hhmm } from "@/lib/time";
import type { Pool, Preset } from "@/lib/types";
import { MAX_PARTY_SEATS, vehicleLabel } from "@/lib/vehicles";

export interface JoinSheetProps {
  /** The ride being joined, or null when closed. */
  pool: Pool | null;
  presets: Preset[];
  onClose: () => void;
}

/** Small sheet that asks how many seats, then joins through the store (optimistic). */
export function JoinSheet({ pool, presets, onClose }: JoinSheetProps) {
  // Keep the last ride on screen while the sheet animates out.
  const [shown, setShown] = useState<Pool | null>(pool);
  if (pool && pool !== shown) setShown(pool);
  const current = pool ?? shown;

  return current ? (
    <JoinSheetBody key={current.id} pool={current} open={pool !== null} presets={presets} onClose={onClose} />
  ) : null;
}

function JoinSheetBody({ pool, open, presets, onClose }: { pool: Pool; open: boolean; presets: Preset[]; onClose: () => void }) {
  const joinPool = useStore((s) => s.joinPool);
  const celebrate = useStore((s) => s.celebrate);
  const [seats, setSeats] = useState(1);
  const [busy, setBusy] = useState(false);

  // While the request is in flight the optimistic copy already counts my seats; do not let the stepper shrink.
  const max = Math.max(seats, Math.min(MAX_PARTY_SEATS, pool.seats_open));
  const from = shortPlaceName(pool.origin, presets);
  const to = shortPlaceName(pool.destination, presets);

  const join = async () => {
    setBusy(true);
    const ok = await joinPool(pool.id, seats);
    setBusy(false);
    if (ok) {
      celebrate("You're in");
      onClose();
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title="Join this ride"
      description={`${dayLabel(pool.window_start)} · leaving between ${hhmm(pool.window_start)} and ${hhmm(pool.window_end)}`}
      footer={
        <Button full size="lg" loading={busy} onClick={join}>
          {seats === 1 ? "Join with 1 seat" : `Join with ${seats} seats`}
        </Button>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="rounded-inner bg-soft p-4">
          <div className="flex items-center gap-3">
            <span className="tnum text-lg font-semibold">{hhmm(pool.window_start)}</span>
            <div className="min-w-0 flex-1">
              <RouteLine vehicle={pool.vehicle} size="sm" />
            </div>
            <span className="tnum text-lg font-semibold">{hhmm(pool.window_end)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{from}</span>
            <span className="min-w-0 truncate text-right">{to}</span>
          </div>
          <div className="mt-3 flex items-start gap-2">
            <Badge tone="outline" icon={<VehicleIcon vehicle={pool.vehicle} size={14} aria-hidden />}>
              {vehicleLabel(pool.vehicle)}
            </Badge>
            {/* Free-form and up to 80 characters, so it wraps instead of sitting in a nowrap badge. */}
            <p className="flex min-w-0 flex-1 items-start gap-1.5 pt-1 text-label text-ink2">
              <MapPin size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
              <span className="min-w-0 [overflow-wrap:anywhere]">Meet at {pool.meeting_point}</span>
            </p>
          </div>
        </div>

        <Stepper
          label="Seats you need"
          hint={pool.seats_open === 1 ? "1 seat is open" : `${pool.seats_open} seats are open`}
          icon={<Users size={20} strokeWidth={1.75} aria-hidden />}
          value={seats}
          onChange={setSeats}
          min={1}
          max={max}
          unit={seats === 1 ? "seat" : "seats"}
          disabled={busy}
        />
      </div>
    </Sheet>
  );
}
