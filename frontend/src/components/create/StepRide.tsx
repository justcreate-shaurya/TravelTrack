"use client";

import { Check, ChevronDown, HandHeart, MapPin, Plane, TrainFront, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import {
  EASE,
  Field,
  Input,
  SeatDots,
  SegmentedTabs,
  SPRING,
  SPRING_POP,
  Stepper,
  Textarea,
  VehicleIcon,
  inputClass,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Preset, TransitMode, Vehicle } from "@/lib/types";
import { VEHICLE_ORDER, VEHICLES, vehicleLabel, vehicleSeats } from "@/lib/vehicles";

import { defaultMeetingPoint, maxMySeats, type CreateForm } from "./form";

export interface StepRideProps {
  form: CreateForm;
  presets: Preset[];
  moreOpen: boolean;
  onToggleMore: () => void;
  onChange: (patch: Partial<CreateForm>) => void;
  /** Problem to show next to its field once the user has tried to post. */
  error: string | null;
}

export function StepRide({ form, presets, moreOpen, onToggleMore, onChange, error }: StepRideProps) {
  const seats = vehicleSeats(form.vehicle);
  const total = form.mySeats + form.giveSeats;
  const fallbackMeeting = defaultMeetingPoint(form.origin, presets);
  const meeting = form.meetingTouched ? form.meetingPoint : fallbackMeeting;

  const pickVehicle = (v: Vehicle) => {
    const cap = vehicleSeats(v);
    const my = Math.min(form.mySeats, maxMySeats(v));
    // A new vehicle starts full: every seat you don't need is offered.
    onChange({ vehicle: v, mySeats: my, giveSeats: cap - my });
  };

  const setMine = (my: number) => onChange({ mySeats: my, giveSeats: Math.max(1, Math.min(form.giveSeats, seats - my)) });

  const transitError = error && form.transitMode !== "none" && !form.transitCode.trim() ? error : null;
  const waError = error && error.includes("WhatsApp") ? error : null;
  const meetError = error && error.startsWith("Pickup point") ? error : null;

  return (
    <div className="space-y-6 pb-6 pt-1">
      <section aria-labelledby="ride-vehicle">
        <p id="ride-vehicle" className="label mb-2 px-1">
          What are you booking?
        </p>
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-labelledby="ride-vehicle">
          {VEHICLE_ORDER.map((v) => {
            const active = v === form.vehicle;
            return (
              <motion.button
                key={v}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${vehicleLabel(v)}, ${VEHICLES[v].seats} seats`}
                onClick={() => pickVehicle(v)}
                whileTap={{ scale: 0.97 }}
                transition={SPRING}
                className={cn(
                  "relative isolate flex min-h-[124px] flex-col justify-between rounded-inner p-4 text-left transition-colors duration-200",
                  active ? "on-dark text-ondark" : "bg-soft text-ink",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="create-vehicle"
                    transition={SPRING}
                    className="absolute inset-0 -z-10 rounded-inner bg-dark shadow-float"
                  />
                )}
                <span className="flex items-start justify-between">
                  <span
                    className={cn(
                      "inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200",
                      active ? "bg-accent text-accentInk" : "bg-surface text-ink2",
                    )}
                  >
                    <VehicleIcon vehicle={v} size={22} />
                  </span>
                  <AnimatePresence>
                    {active && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={SPRING_POP}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accentInk"
                        aria-hidden
                      >
                        <Check size={14} strokeWidth={2.5} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span className="mt-3 block">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-semibold leading-6">{vehicleLabel(v)}</span>
                    <span className={cn("tnum text-label", active ? "text-ondark2" : "text-ink3")}>{VEHICLES[v].seats} seats</span>
                  </span>
                  <span className={cn("block truncate text-label", active ? "text-ondark2" : "text-ink3")}>
                    {VEHICLES[v].examples}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2.5" aria-label="Seats">
        <Stepper
          label="Seats for you"
          hint="You and anyone with you"
          icon={<UserRound size={18} strokeWidth={1.75} />}
          value={form.mySeats}
          onChange={setMine}
          min={1}
          max={maxMySeats(form.vehicle)}
          unit="seats"
        />
        <Stepper
          label="Seats to give"
          hint="Open for others to join"
          icon={<HandHeart size={18} strokeWidth={1.75} />}
          value={form.giveSeats}
          onChange={(n) => onChange({ giveSeats: n })}
          min={1}
          max={seats - form.mySeats}
          unit="seats"
        />
        <div className="flex items-center justify-between gap-3 px-1 pt-1">
          <SeatDots key={form.vehicle} taken={form.mySeats} total={total} />
          <p className="tnum text-label text-ink3">
            {total} of {seats} seats in this {vehicleLabel(form.vehicle)}
          </p>
        </div>
      </section>

      <section>
        <motion.button
          type="button"
          onClick={onToggleMore}
          aria-expanded={moreOpen}
          aria-controls="create-more"
          whileTap={{ scale: 0.98 }}
          transition={SPRING}
          className="flex h-14 w-full items-center justify-between rounded-inner bg-soft px-4 text-left"
        >
          <span>
            <span className="block font-medium">More options</span>
            <span className="block text-label text-ink3">Pickup point, note, train or flight, WhatsApp</span>
          </span>
          <motion.span animate={{ rotate: moreOpen ? 180 : 0 }} transition={SPRING} className="text-ink2" aria-hidden>
            <ChevronDown size={20} strokeWidth={1.75} />
          </motion.span>
        </motion.button>

        <AnimatePresence initial={false}>
          {moreOpen && (
            <motion.div
              id="create-more"
              key="more"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.14 } }}
              transition={EASE}
              className="space-y-5 pt-4"
            >
              <Field label="Pickup point" hint="Where everyone meets. Clear it to go back to the default." error={meetError}>
                <Input
                  value={meeting}
                  onChange={(e) => onChange({ meetingPoint: e.target.value, meetingTouched: true })}
                  onBlur={() => {
                    if (form.meetingTouched && !form.meetingPoint.trim()) onChange({ meetingPoint: "", meetingTouched: false });
                  }}
                  placeholder={fallbackMeeting || "e.g. Main gate"}
                  maxLength={80}
                  leading={<MapPin size={18} strokeWidth={1.75} />}
                />
              </Field>

              <Field label="Note" aside={<span className="tnum">{form.note.length}/140</span>}>
                <Textarea
                  value={form.note}
                  onChange={(e) => onChange({ note: e.target.value })}
                  placeholder="Anything riders should know, like a stop on the way"
                  maxLength={140}
                  rows={2}
                />
              </Field>

              <div>
                <p className="mb-1.5 px-1 text-label font-medium text-ink2">Catching a train or flight?</p>
                <SegmentedTabs<TransitMode>
                  label="Train or flight"
                  tone="soft"
                  value={form.transitMode}
                  onChange={(v) => onChange({ transitMode: v })}
                  options={[
                    { value: "none", label: "No" },
                    { value: "train", label: "Train", icon: <TrainFront size={16} strokeWidth={1.75} /> },
                    { value: "flight", label: "Flight", icon: <Plane size={16} strokeWidth={1.75} /> },
                  ]}
                />
                <AnimatePresence initial={false}>
                  {form.transitMode !== "none" && (
                    <motion.div
                      key="transit"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={EASE}
                      className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2.5"
                    >
                      <Field
                        label={form.transitMode === "train" ? "Train number" : "Flight number"}
                        error={transitError}
                        hint="Riders on the same one are matched first"
                      >
                        <Input
                          value={form.transitCode}
                          onChange={(e) => onChange({ transitCode: e.target.value })}
                          placeholder={form.transitMode === "train" ? "12046" : "6E 2175"}
                          maxLength={40}
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </Field>
                      <Field label={form.transitMode === "train" ? "Train time" : "Flight time"}>
                        <input
                          type="time"
                          className={cn(inputClass, "tnum w-[8.5rem]")}
                          value={form.transitTime}
                          onChange={(e) => onChange({ transitTime: e.target.value.slice(0, 5) })}
                        />
                      </Field>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Field label="WhatsApp group link" aside="Optional" error={waError} hint="Only riders who join can see it">
                <Input
                  type="url"
                  inputMode="url"
                  value={form.whatsappUrl}
                  onChange={(e) => onChange({ whatsappUrl: e.target.value })}
                  placeholder="https://chat.whatsapp.com/..."
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
