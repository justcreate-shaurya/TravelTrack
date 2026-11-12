"use client";

import { CalendarDays, Clock3, Hourglass } from "lucide-react";
import { useMemo, useRef } from "react";

import { AnimatedNumber, DateStrip, Pill, inputClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { addMinutes, dayKeyLabel, istDateKey, nextDays } from "@/lib/time";

import { FLEX_OPTIONS, MAX_DAYS_AHEAD, type CreateForm } from "./form";

export interface StepWhenProps {
  form: CreateForm;
  onChange: (patch: Partial<CreateForm>) => void;
}

export function StepWhen({ form, onChange }: StepWhenProps) {
  const dateRef = useRef<HTMLInputElement>(null);
  const strip = useMemo(() => new Set(nextDays(7).map((d) => d.key)), []);
  const inStrip = strip.has(form.date);
  const end = addMinutes(form.time, form.flex);
  const [h1, m1] = form.time.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const validTime = Number.isFinite(h1) && Number.isFinite(m1);

  const openPicker = () => {
    const el = dateRef.current;
    if (!el) return;
    try {
      el.showPicker?.();
    } catch {
      el.focus();
    }
  };

  return (
    <div className="space-y-6 pb-6 pt-1">
      <section aria-labelledby="when-day">
        <p id="when-day" className="label mb-2 px-1">
          Day
        </p>
        <DateStrip value={inStrip ? form.date : null} onChange={(d) => d && onChange({ date: d })} tone="soft" />

        {/* The native date input sits invisibly over the chip so a tap opens the system picker. */}
        <div
          className={cn(
            "relative mt-3 inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium",
            "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accentDeep",
            inStrip ? "bg-soft text-ink2" : "bg-ink text-surface",
          )}
        >
          <CalendarDays size={18} strokeWidth={1.75} aria-hidden />
          <span>{inStrip ? "More dates" : dayKeyLabel(form.date)}</span>
          <input
            ref={dateRef}
            type="date"
            aria-label="More dates"
            className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0"
            value={form.date}
            min={istDateKey(0)}
            max={istDateKey(MAX_DAYS_AHEAD)}
            onClick={openPicker}
            onChange={(e) => e.target.value && onChange({ date: e.target.value })}
          />
        </div>
      </section>

      <section>
        <label htmlFor="when-time" className="label mb-2 block px-1">
          Leave at
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 text-ink3" aria-hidden>
            <Clock3 size={18} strokeWidth={1.75} />
          </span>
          <input
            id="when-time"
            type="time"
            className={cn(inputClass, "tnum pl-11 text-lg font-semibold")}
            value={form.time}
            step={300}
            onChange={(e) => e.target.value && onChange({ time: e.target.value.slice(0, 5) })}
          />
        </div>
      </section>

      <section aria-labelledby="when-flex">
        <p id="when-flex" className="label mb-2 px-1">
          How long can you wait?
        </p>
        <div className="grid grid-cols-4 gap-2" role="group" aria-labelledby="when-flex">
          {FLEX_OPTIONS.map((m) => (
            <Pill
              key={m}
              tone="soft"
              selected={form.flex === m}
              onClick={() => onChange({ flex: m })}
              className="w-full justify-center px-0"
              aria-label={`${m} minutes`}
            >
              <span className="tnum">{m} min</span>
            </Pill>
          ))}
        </div>
      </section>

      {validTime && (
        <div className="on-dark flex items-center gap-4 rounded-card bg-dark p-5 text-ondark shadow-float">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accentInk" aria-hidden>
            <Hourglass size={20} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="label">Leaving window, {dayKeyLabel(form.date)}</p>
            <p className="text-[28px] font-semibold leading-9" aria-label={`${form.time} to ${end}`}>
              <AnimatedNumber value={h1} format={pad} />:<AnimatedNumber value={m1} format={pad} />
              <span className="mx-2 text-ondark2">–</span>
              <AnimatedNumber value={h2} format={pad} />:<AnimatedNumber value={m2} format={pad} />
            </p>
            <p className="text-label text-ondark2">People leaving around then get pointed to your ride.</p>
          </div>
        </div>
      )}
    </div>
  );
}
