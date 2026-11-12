"use client";

import { ArrowUpDown, ChevronRight, Route } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Badge, EASE, IconButton, Pill, RouteLine, SPRING } from "@/components/ui";
import { cn } from "@/lib/cn";
import { distanceKm, formatDistance, isPlaksha, nearestPreset, presetToPlace, samePlace } from "@/lib/geo";
import type { Place, Preset } from "@/lib/types";

import type { CreateForm, PlaceTarget } from "./form";

export interface StepWhereProps {
  form: CreateForm;
  presets: Preset[];
  onOpenPicker: (target: PlaceTarget) => void;
  onSet: (target: PlaceTarget, place: Place) => void;
  onSwap: () => void;
}

/** Which end a quick pick fills: the first empty one, else the end that is not Plaksha. */
function quickTarget(form: CreateForm): PlaceTarget {
  if (!form.origin) return "origin";
  if (!form.destination) return "destination";
  if (isPlaksha(form.destination.lat, form.destination.lng) && !isPlaksha(form.origin.lat, form.origin.lng)) return "origin";
  return "destination";
}

export function StepWhere({ form, presets, onOpenPicker, onSet, onSwap }: StepWhereProps) {
  const [turns, setTurns] = useState(0);
  const target = quickTarget(form);
  const other = target === "origin" ? form.destination : form.origin;
  const current = target === "origin" ? form.origin : form.destination;
  const quick = presets.filter((p) => !other || !samePlace(p, other));
  const both = form.origin && form.destination;
  const same = both && samePlace(form.origin!, form.destination!);

  const pickup = form.origin ? nearestPreset(presets, form.origin.lat, form.origin.lng)?.pickup : undefined;

  const swap = () => {
    setTurns((n) => n + 1);
    onSwap();
  };

  return (
    <div className="space-y-5 pb-6 pt-1">
      <p className="text-[15px] text-ink2">Any place works: a hostel gate, a sector market, the airport.</p>

      {/* From / To card */}
      <div className="relative rounded-card bg-soft p-2">
        <div className="flex items-stretch gap-1">
          <div className="flex shrink-0 py-7 pl-3">
            <RouteLine orientation="vertical" size="sm" color="accent" variant="solid" />
          </div>
          <div className="min-w-0 flex-1">
            <PlaceRow
              label="From"
              place={form.origin}
              placeholder="Choose pickup"
              detail={pickup ? `Meet at ${pickup}` : undefined}
              onClick={() => onOpenPicker("origin")}
            />
            <div className="ml-3 mr-16 h-px bg-line" aria-hidden />
            <PlaceRow
              label="To"
              place={form.destination}
              placeholder="Choose drop"
              onClick={() => onOpenPicker("destination")}
            />
          </div>
        </div>
        <motion.div
          className="absolute right-4 top-1/2 -mt-[22px]"
          animate={{ rotate: turns * 180 }}
          transition={SPRING}
        >
          <IconButton label="Swap pickup and drop" variant="surface" onClick={swap} disabled={!form.origin && !form.destination}>
            <ArrowUpDown size={18} strokeWidth={1.75} />
          </IconButton>
        </motion.div>
      </div>

      <AnimatePresence initial={false}>
        {both && !same && (
          <motion.div
            key="distance"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={EASE}
            className="flex justify-center"
          >
            <Badge tone="accent" icon={<Route size={14} strokeWidth={1.75} />}>
              About {formatDistance(distanceKm(form.origin!, form.destination!))} apart
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>

      {quick.length > 0 && (
        <div>
          <p className="label mb-2 px-1">{target === "origin" ? "Quick pickup" : "Quick drop"}</p>
          <div className="rail py-1">
            {quick.map((p) => (
              <Pill
                key={p.key}
                tone="soft"
                selected={!!current && samePlace(p, current)}
                onClick={() => onSet(target, presetToPlace(p))}
              >
                {p.short}
              </Pill>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlaceRow({
  label,
  place,
  placeholder,
  detail,
  onClick,
}: {
  label: string;
  place: Place | null;
  placeholder: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={SPRING}
      aria-label={place ? `${label}: ${place.name}. Change` : `${label}: ${placeholder}`}
      className="flex min-h-[68px] w-full items-center gap-2 rounded-inner py-2 pl-3 pr-16 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="label block">{label}</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={place ? `${place.name}|${place.lat}|${place.lng}` : "empty"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="block"
          >
            <span className={cn("block truncate text-[17px] font-semibold leading-6", !place && "font-medium text-ink3")}>
              {place ? place.name : placeholder}
            </span>
            {detail ? <span className="block truncate text-label text-ink3">{detail}</span> : null}
          </motion.span>
        </AnimatePresence>
      </span>
      {!place && <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink3" aria-hidden />}
    </motion.button>
  );
}
