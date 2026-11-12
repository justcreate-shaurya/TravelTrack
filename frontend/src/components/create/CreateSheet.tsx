"use client";

import { ArrowRight, ChevronLeft, Send, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button, IconButton, Sheet, SPRING } from "@/components/ui";
import { api, errorMessage, matchesFromError, type ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { samePlace } from "@/lib/geo";
import { haptic } from "@/lib/haptics";
import { firstName } from "@/lib/names";
import { ROUTES } from "@/lib/routes";
import { useStore } from "@/lib/store";
import type { Match, Place } from "@/lib/types";

import {
  LAST_STEP,
  STEP_TITLES,
  cleanPlace,
  errorInMoreOptions,
  initialForm,
  stepError,
  summaryLine,
  toPoolCreate,
  type CreateForm,
  type PlaceTarget,
} from "./form";
import { MatchIntercept } from "./MatchIntercept";
import { PlacePicker } from "./PlacePicker";
import { StepRide } from "./StepRide";
import { StepWhen } from "./StepWhen";
import { StepWhere } from "./StepWhere";

/** The create-ride wizard. Mounted once by the signed-in layout; opened with `openCreate()` from the store. */
export function CreateSheet() {
  const open = useStore((s) => s.createOpen);
  // A fresh wizard (and fresh state) for every opening.
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((n) => n + 1);
  }
  return <Wizard key={session} open={open} />;
}

interface Intercept {
  message: string;
  matches: Match[];
}

const slide = {
  enter: (dir: number) => ({ x: dir * 36, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -36, opacity: 0 }),
};

function Wizard({ open }: { open: boolean }) {
  const router = useRouter();
  const presets = useStore((s) => s.presets);
  const loadPresets = useStore((s) => s.loadPresets);
  const closeCreate = useStore((s) => s.closeCreate);
  const upsertPool = useStore((s) => s.upsertPool);
  const showToast = useStore((s) => s.showToast);
  const celebrate = useStore((s) => s.celebrate);

  const [form, setForm] = useState<CreateForm>(() => {
    const s = useStore.getState();
    return initialForm({ presets: s.presets, direction: s.filters.direction, prefill: s.createPrefill });
  });
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [showError, setShowError] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [picker, setPicker] = useState<PlaceTarget | null>(null);
  const [intercept, setIntercept] = useState<Intercept | null>(null);
  const [posting, setPosting] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const busy = posting || joiningId !== null;
  const view = intercept ? "matches" : `step-${step}`;
  const error = intercept ? null : stepError(form, step);

  useEffect(() => {
    if (open) void loadPresets();
  }, [open, loadPresets]);

  // Each view starts at the top of the sheet.
  useEffect(() => {
    const scroller = topRef.current?.parentElement;
    if (scroller) scroller.scrollTop = 0;
  }, [view]);

  const patch = useCallback((p: Partial<CreateForm>) => setForm((f) => ({ ...f, ...p })), []);

  const setPlace = useCallback((target: PlaceTarget, place: Place) => {
    const next = cleanPlace(place);
    setForm((f) => {
      const otherKey: PlaceTarget = target === "origin" ? "destination" : "origin";
      const other = f[otherKey];
      // Picking the place that is already at the other end swaps the two instead of clashing.
      if (other && samePlace(other, next)) return { ...f, [target]: next, [otherKey]: f[target] };
      return { ...f, [target]: next };
    });
  }, []);

  const swap = useCallback(() => {
    haptic(8);
    setForm((f) => ({ ...f, origin: f.destination, destination: f.origin }));
  }, []);

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setShowError(false);
    setStep(to);
  };

  const finish = (poolId: string) => {
    closeCreate();
    router.push(ROUTES.pool(poolId));
  };

  const post = async (force: boolean) => {
    if (busy) return;
    setPosting(true);
    try {
      const pool = await api.createPool(toPoolCreate(form, force));
      upsertPool(pool, true);
      celebrate("Ride posted");
      showToast("Ride posted. People heading your way will be pointed to it.", "success");
      finish(pool.id);
    } catch (e) {
      const matches = matchesFromError(e);
      if (matches && matches.length > 0) {
        haptic(16);
        setDir(1);
        setIntercept({ message: (e as ApiError).message, matches });
      } else if (matches) {
        // A match was reported but none came with it: nothing to offer, so post as asked.
        return await post(true);
      } else {
        showToast(errorMessage(e, "Couldn't post the ride"), "error");
      }
    } finally {
      setPosting(false);
    }
  };

  const join = async (match: Match) => {
    if (busy) return;
    setJoiningId(match.pool.id);
    try {
      const pool = await api.join(match.pool.id, form.mySeats);
      upsertPool(pool, true);
      celebrate("You're in");
      showToast(`You joined ${firstName(match.pool.creator.name)}'s ride`, "success");
      finish(pool.id);
    } catch (e) {
      showToast(errorMessage(e, "Couldn't join that ride"), "error", {
        label: "Post mine",
        onClick: () => void post(true),
      });
    } finally {
      setJoiningId(null);
    }
  };

  const next = () => {
    if (error) {
      setShowError(true);
      haptic([10, 40, 10]);
      if (step === LAST_STEP && errorInMoreOptions(form)) setMoreOpen(true);
      return;
    }
    if (step < LAST_STEP) go(step + 1);
    else void post(false);
  };

  const back = () => {
    if (busy) return;
    if (intercept) {
      setDir(-1);
      setIntercept(null);
    } else if (step > 0) go(step - 1);
  };

  const title = intercept ? "Someone's already going" : STEP_TITLES[step];
  const caption = intercept
    ? intercept.matches.length === 1
      ? "1 ride near your pickup"
      : `${intercept.matches.length} rides near your pickup`
    : `Step ${step + 1} of ${STEP_TITLES.length}`;
  const summary = summaryLine(form, intercept ? LAST_STEP : step, presets);
  const errorShown = showError && error ? error : null;

  const header = (
    <div className="px-5 pb-3 pt-1 lg:px-7 lg:pt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label tnum">{caption}</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="truncate text-2xl font-semibold leading-8"
            >
              {title}
            </motion.h2>
          </AnimatePresence>
        </div>
        <IconButton label="Close" onClick={closeCreate} disabled={busy}>
          <X size={20} strokeWidth={1.75} />
        </IconButton>
      </div>
      <div
        className="mt-3 flex gap-1.5"
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={1}
        aria-valuemax={STEP_TITLES.length}
        aria-valuenow={step + 1}
        aria-valuetext={`Step ${step + 1} of ${STEP_TITLES.length}`}
      >
        {STEP_TITLES.map((t, i) => (
          <span key={t} className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft">
            <motion.span
              className={cn("block h-full origin-left rounded-full", intercept ? "bg-warn" : "bg-accent")}
              initial={false}
              animate={{ scaleX: i <= step ? 1 : 0 }}
              transition={SPRING}
            />
          </span>
        ))}
      </div>
    </div>
  );

  const footer = (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={errorShown ? `e:${errorShown}` : intercept ? "m" : "s"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          role={errorShown ? "alert" : undefined}
          className={cn("mb-2.5 truncate px-1 text-label", errorShown ? "font-medium text-danger" : "text-ink2")}
        >
          {errorShown ?? (intercept ? `Yours: ${summary}` : summary)}
        </motion.p>
      </AnimatePresence>
      <div className="flex items-center gap-2">
        {(step > 0 || intercept) && (
          <IconButton label="Back" size="lg" onClick={back} disabled={busy}>
            <ChevronLeft size={22} strokeWidth={1.75} />
          </IconButton>
        )}
        {intercept ? (
          <Button
            variant="dark"
            size="lg"
            className="min-w-0 flex-1"
            loading={posting}
            disabled={joiningId !== null}
            onClick={() => void post(true)}
          >
            Post mine anyway
          </Button>
        ) : (
          <Button
            size="lg"
            className="min-w-0 flex-1"
            loading={posting}
            onClick={next}
            iconRight={
              step === LAST_STEP ? <Send size={18} strokeWidth={1.75} /> : <ArrowRight size={18} strokeWidth={1.75} />
            }
          >
            {step === LAST_STEP ? "Post ride" : "Next"}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Sheet
        open={open}
        onClose={closeCreate}
        ariaLabel="Post a ride"
        header={header}
        footer={footer}
        height="tall"
        dismissible={!busy}
        padded={false}
      >
        {/* Clipped sideways so the step slide never causes a horizontal scroll. */}
        <div ref={topRef} className="overflow-x-clip px-5 lg:px-7">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={view}
              custom={dir}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: SPRING, opacity: { duration: 0.16 } }}
            >
              {intercept ? (
                <MatchIntercept
                  message={intercept.message}
                  matches={intercept.matches}
                  presets={presets}
                  seats={form.mySeats}
                  joiningId={joiningId}
                  busy={busy}
                  onJoin={join}
                />
              ) : step === 0 ? (
                <StepWhere form={form} presets={presets} onOpenPicker={setPicker} onSet={setPlace} onSwap={swap} />
              ) : step === 1 ? (
                <StepWhen form={form} onChange={patch} />
              ) : (
                <StepRide
                  form={form}
                  presets={presets}
                  moreOpen={moreOpen}
                  onToggleMore={() => setMoreOpen((v) => !v)}
                  onChange={patch}
                  error={errorShown}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Sheet>

      <PlacePicker
        target={open ? picker : null}
        onClose={() => setPicker(null)}
        onPick={(place) => {
          if (picker) setPlace(picker, place);
          setPicker(null);
        }}
      />
    </>
  );
}
