"use client";

import { Check, Link2, MapPin, Users } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { Button, Field, Input, Sheet, SPRING, SPRING_POP, Stepper, VehicleIcon } from "@/components/ui";
import { cn } from "@/lib/cn";
import { WA_GROUP_HINT, isWaGroupLink, normalizeWaGroupLink } from "@/lib/links";
import type { PoolDetail, PoolUpdate, Vehicle } from "@/lib/types";
import { MIN_POOL_SEATS, VEHICLE_ORDER, vehicleLabel, vehicleSeats } from "@/lib/vehicles";

import { seatWord } from "./util";

export interface CreatorSheetProps {
  open: boolean;
  onClose: () => void;
  pool: PoolDetail;
  busy: boolean;
  onSave: (body: PoolUpdate) => void;
}

/** Creator settings: vehicle, total seats, pickup point, WhatsApp group link. One Save. */
export function CreatorSheet({ open, onClose, pool, busy, onSave }: CreatorSheetProps) {
  const [vehicle, setVehicle] = useState<Vehicle>(pool.vehicle);
  const [total, setTotal] = useState(pool.max_seats);
  const [meet, setMeet] = useState(pool.meeting_point);
  const [group, setGroup] = useState(pool.whatsapp_group_url ?? "");

  // Start from the live values each time the sheet opens (someone else's change may have landed).
  useEffect(() => {
    if (!open) return;
    setVehicle(pool.vehicle);
    setTotal(pool.max_seats);
    setMeet(pool.meeting_point);
    setGroup(pool.whatsapp_group_url ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const minTotal = Math.max(MIN_POOL_SEATS, pool.seats_taken);
  const maxTotal = vehicleSeats(vehicle);
  const fits = minTotal <= maxTotal;
  const totalValue = Math.min(Math.max(total, minTotal), maxTotal);

  const pick = (v: Vehicle) => {
    setVehicle(v);
    // Moving up keeps the seat count; moving down caps it at the new vehicle.
    setTotal((t) => Math.min(Math.max(t, minTotal), vehicleSeats(v)));
  };

  // Cleaned the same way as in the create wizard, and checked against the server's rule.
  const groupTrim = normalizeWaGroupLink(group);
  const groupError = groupTrim && !isWaGroupLink(groupTrim) ? WA_GROUP_HINT : null;
  const meetTrim = meet.trim();
  const meetError = meetTrim.length === 1 || meetTrim.length > 80 ? "Use 2 to 80 characters, or leave it blank for the default" : null;

  const body: PoolUpdate = {};
  if (vehicle !== pool.vehicle) body.vehicle = vehicle;
  if (vehicle !== pool.vehicle || totalValue !== pool.max_seats) body.max_seats = totalValue;
  if (meetTrim !== pool.meeting_point) body.meeting_point = meetTrim || null;
  if (groupTrim !== (pool.whatsapp_group_url ?? "")) body.whatsapp_group_url = groupTrim || null;
  const dirty = Object.keys(body).length > 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title="Ride settings"
      description="Only you can change these. Riders see the changes right away."
      footer={
        <Button full size="lg" loading={busy} disabled={!dirty || !fits || !!groupError || !!meetError} onClick={() => onSave(body)}>
          {dirty ? "Save changes" : "Nothing to save"}
        </Button>
      }
    >
      <div className="space-y-5 pb-5">
        <div>
          <p className="mb-2 px-1 text-label font-medium text-ink2" id="vehicle-label">
            Vehicle
          </p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="vehicle-label">
            {VEHICLE_ORDER.map((v) => {
              const selected = v === vehicle;
              const tooSmall = vehicleSeats(v) < pool.seats_taken;
              return (
                <motion.button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={busy || tooSmall}
                  onClick={() => pick(v)}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING}
                  className={cn(
                    "relative flex min-h-[76px] items-center gap-3 rounded-inner p-3 text-left disabled:opacity-40",
                    selected ? "on-dark bg-dark text-ondark" : "bg-soft text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                      selected ? "bg-accent text-accentInk" : "bg-surface text-ink2",
                    )}
                  >
                    <VehicleIcon vehicle={v} size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{vehicleLabel(v)}</span>
                    <span className={cn("tnum block text-label", selected ? "text-ondark2" : "text-ink3")}>
                      {tooSmall ? "Too small now" : `Up to ${seatWord(vehicleSeats(v))}`}
                    </span>
                  </span>
                  {selected && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={SPRING_POP}
                      className="absolute right-2.5 top-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accentInk"
                      aria-hidden
                    >
                      <Check size={12} strokeWidth={2.5} />
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        <Stepper
          label="Total seats"
          hint={pool.seats_taken > 0 ? `${seatWord(pool.seats_taken)} taken already` : "Including you"}
          icon={<Users size={18} strokeWidth={1.75} />}
          value={totalValue}
          onChange={setTotal}
          min={minTotal}
          max={maxTotal}
          unit="seats"
          disabled={busy || !fits}
        />

        <Field label="Pickup point" hint="Leave blank to use the default for this pickup" error={meetError}>
          <Input
            leading={<MapPin size={18} strokeWidth={1.75} aria-hidden />}
            value={meet}
            maxLength={80}
            disabled={busy}
            onChange={(e) => setMeet(e.target.value)}
            placeholder="Main gate"
          />
        </Field>

        <Field label="WhatsApp group link" aside="Optional" hint="Riders get it as soon as they join" error={groupError}>
          <Input
            leading={<Link2 size={18} strokeWidth={1.75} aria-hidden />}
            value={group}
            disabled={busy}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="https://chat.whatsapp.com/…"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
      </div>
    </Sheet>
  );
}
