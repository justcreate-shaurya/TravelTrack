"use client";

import { ChevronRight, LoaderCircle, LocateFixed, MapPin, RotateCw, Search, SearchX, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { Button, EmptyState, IconButton, Input, Sheet, Skeleton, SPRING, Stagger, StaggerItem } from "@/components/ui";
import { api, errorMessage, isAbort } from "@/lib/api";
import { cn } from "@/lib/cn";
import { deviceFixToPlace, presetToPlace } from "@/lib/geo";
import { useStore } from "@/lib/store";
import type { Place, PlaceResult, Preset } from "@/lib/types";
import { useGeolocation } from "@/lib/useGeolocation";

import { cleanPlace, type PlaceTarget } from "./form";

export interface PlacePickerProps {
  /** Which end is being chosen; null keeps the sheet closed. */
  target: PlaceTarget | null;
  onClose: () => void;
  onPick: (place: Place) => void;
}

const COPY: Record<PlaceTarget, { title: string; description: string; placeholder: string }> = {
  origin: { title: "Pickup", description: "Where does the ride start?", placeholder: "Search a pickup place" },
  destination: { title: "Drop", description: "Where is the ride going?", placeholder: "Search a drop place" },
};

/** A second sheet over the wizard: search any place, use the device location, or tap a preset. */
export function PlacePicker({ target, onClose, onPick }: PlacePickerProps) {
  // Keep the last target while the sheet animates out so the title does not flash.
  const [last, setLast] = useState<PlaceTarget>("origin");
  if (target && target !== last) setLast(target);
  const copy = COPY[target ?? last];

  return (
    <Sheet open={target !== null} onClose={onClose} title={copy.title} description={copy.description} height="tall">
      <PickerBody placeholder={copy.placeholder} onPick={onPick} />
    </Sheet>
  );
}

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; results: PlaceResult[] }
  | { status: "error"; message: string };

function PickerBody({ placeholder, onPick }: { placeholder: string; onPick: (place: Place) => void }) {
  const presets = useStore((s) => s.presets);
  const loadPresets = useStore((s) => s.loadPresets);
  const showToast = useStore((s) => s.showToast);
  const geo = useGeolocation();

  const [q, setQ] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [locating, setLocating] = useState(false);

  const term = q.trim();
  const searching = term.length >= 2;

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  // Debounced search; a newer keystroke cancels the request in flight.
  useEffect(() => {
    if (term.length < 2) {
      setSearch({ status: "idle" });
      return;
    }
    setSearch({ status: "loading" });
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await api.placeSearch(term.slice(0, 80), { limit: 6, signal: ctrl.signal });
        setSearch({ status: "done", results });
      } catch (e) {
        if (isAbort(e)) return;
        setSearch({ status: "error", message: errorMessage(e, "Place search is unavailable right now") });
      }
    }, 280);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [term, attempt]);

  // Presets still work when the geocoder is down.
  const presetHits = useMemo(() => {
    const needle = term.toLowerCase();
    return presets.filter((p) => p.name.toLowerCase().includes(needle) || p.short.toLowerCase().includes(needle));
  }, [presets, term]);

  const useCurrent = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const loc = await geo.request();
      if (!loc) {
        showToast("Couldn't get your location. Check that location access is allowed.", "error");
        return;
      }
      // Named on the device (a preset, or "Current location"): the raw fix is not sent to any server.
      onPick(cleanPlace(deviceFixToPlace(presets, loc)));
    } finally {
      setLocating(false);
    }
  };

  const pickPreset = (p: Preset) => onPick(presetToPlace(p));

  // The sheet does not shrink when the on-screen keyboard opens, so results can sit behind it.
  // Pad the list by the keyboard's height so they can be scrolled into view, and put the
  // keyboard away on Search/Enter or as soon as the list is dragged.
  const keyboard = useKeyboardInset();
  const hideKeyboard = () => {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement) el.blur();
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    hideKeyboard();
  };

  return (
    <div className="pb-6" style={keyboard > 0 ? { paddingBottom: keyboard + 24 } : undefined}>
      <form role="search" onSubmit={onSubmit} className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3 pt-1">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={80}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          leading={<Search size={18} strokeWidth={1.75} />}
          trailing={
            q ? (
              <IconButton label="Clear search" variant="ghost" size="sm" onClick={() => setQ("")}>
                <X size={18} strokeWidth={1.75} />
              </IconButton>
            ) : undefined
          }
        />
      </form>

      <div onTouchMove={hideKeyboard}>
      {!searching && (
        <>
          <PlaceRow
            tone="accent"
            icon={
              locating ? (
                <LoaderCircle size={20} strokeWidth={1.75} className="animate-spin" />
              ) : (
                <LocateFixed size={20} strokeWidth={1.75} />
              )
            }
            name="Use my current location"
            detail={locating ? "Finding you…" : "Sets this to where you are right now"}
            onClick={useCurrent}
            disabled={locating}
          />

          <p className="label mb-2 mt-5 px-1">Popular places</p>
          {presets.length === 0 ? (
            <div className="space-y-2" role="status" aria-label="Loading places">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-inner" />
              ))}
            </div>
          ) : (
            <Stagger as="ul" className="space-y-2">
              {presets.map((p) => (
                <StaggerItem as="li" key={p.key}>
                  <PlaceRow code={p.code} name={p.name} detail={p.pickup} onClick={() => pickPreset(p)} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </>
      )}

      {searching && search.status === "loading" && (
        <div className="space-y-2" role="status" aria-label="Searching">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-inner" />
          ))}
        </div>
      )}

      {searching && search.status === "done" && search.results.length > 0 && (
        <Stagger as="ul" className="space-y-2" key={term}>
          {search.results.map((r, i) => (
            <StaggerItem as="li" key={`${r.lat},${r.lng},${i}`}>
              <PlaceRow
                icon={<MapPin size={20} strokeWidth={1.75} />}
                name={r.name}
                detail={r.detail}
                onClick={() => onPick(cleanPlace(r))}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {searching && search.status === "done" && search.results.length === 0 && (
        <EmptyState
          variant="plain"
          icon={<SearchX size={26} strokeWidth={1.75} />}
          title="No place found"
          body="Try a nearby landmark, a sector or a shorter name."
        />
      )}

      {searching && search.status === "error" && (
        <>
          <div className="flex items-center justify-between gap-3 rounded-inner bg-soft p-4" role="alert">
            <p className="min-w-0 text-sm text-ink2">{search.message}</p>
            <Button
              variant="dark"
              size="sm"
              className="shrink-0"
              icon={<RotateCw size={16} strokeWidth={1.75} />}
              onClick={() => setAttempt((n) => n + 1)}
            >
              Retry
            </Button>
          </div>
          {presetHits.length > 0 && (
            <ul className="mt-3 space-y-2">
              {presetHits.map((p) => (
                <li key={p.key}>
                  <PlaceRow code={p.code} name={p.name} detail={p.pickup} onClick={() => pickPreset(p)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      </div>
    </div>
  );
}

/** Height in px of the on-screen keyboard (0 when closed or when the browser resizes the layout itself). */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const hidden = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      // Small differences are browser toolbars or pinch zoom, not a keyboard.
      setInset(hidden > 120 ? hidden : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

function PlaceRow({
  icon,
  code,
  name,
  detail,
  onClick,
  disabled,
  tone = "soft",
}: {
  icon?: ReactNode;
  /** Short preset code shown in place of an icon. */
  code?: string;
  name: string;
  detail?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "soft" | "accent";
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
      className={cn(
        "flex min-h-16 w-full items-center gap-3 rounded-inner p-3 text-left disabled:opacity-70",
        tone === "accent" ? "bg-accent/25" : "bg-soft",
      )}
    >
      <span
        className={cn(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          tone === "accent" ? "bg-accent text-accentInk" : "bg-surface text-ink2",
        )}
        aria-hidden
      >
        {icon ?? <span className="text-2xs font-semibold">{code}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{name}</span>
        {detail ? <span className="block truncate text-label text-ink3">{detail}</span> : null}
      </span>
      <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink3" aria-hidden />
    </motion.button>
  );
}
