"use client";

import { ArrowRight, Car, FlaskConical, MapPin, Navigation, Route } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { AvatarStack, Badge, Button, FadeIn, Field, Input, PageTransition, SeatDots, SPRING_POP } from "@/components/ui";
import { ROUTES } from "@/components/ui/AppShell";
import { api, errorMessage } from "@/lib/api";
import { startMicrosoftLogin } from "@/lib/msauth";
import { useStore } from "@/lib/store";
import type { Meta } from "@/lib/types";

function nextPath(): string {
  if (typeof window === "undefined") return "/";
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useStore((s) => s.setAuth);
  const token = useStore((s) => s.token);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [devEmail, setDevEmail] = useState("");
  const [busy, setBusy] = useState<"microsoft" | "dev" | null>(null);

  useEffect(() => {
    if (token) router.replace(nextPath());
  }, [token, router]);

  const loadMeta = useCallback(() => {
    setOffline(false);
    setError(null);
    api
      .meta()
      .then(setMeta)
      .catch(() => {
        setOffline(true);
        setError("Can't reach the TravelTrack server.");
      });
  }, []);

  useEffect(loadMeta, [loadMeta]);

  const microsoft = async () => {
    if (!meta) return;
    setBusy("microsoft");
    setError(null);
    try {
      await startMicrosoftLogin({
        clientId: meta.ms_client_id,
        tenant: meta.ms_tenant,
        domainHint: meta.allowed_domain,
        next: nextPath(),
      });
    } catch {
      setBusy(null);
      setError("Couldn't start Microsoft sign-in");
    }
  };

  const devLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("dev");
    setError(null);
    try {
      const res = await api.devLogin(devEmail.trim());
      setAuth(res.token, res.user);
      router.replace(res.user.onboarded ? nextPath() : ROUTES.onboarding);
    } catch (err) {
      setError(errorMessage(err, "Sign-in failed"));
    } finally {
      setBusy(null);
    }
  };

  const domain = meta?.allowed_domain ?? "plaksha.edu.in";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-phone flex-col bg-canvas lg:max-w-none text-ink">
      <PageTransition className="pt-safe pb-safe flex flex-1 flex-col px-5 lg:grid lg:grid-cols-[55fr_45fr] lg:gap-4 lg:p-4">
        {/* Brand + hero (the dark panel on desktop) */}
        <div className="contents lg:flex lg:min-h-[calc(100dvh-2rem)] lg:flex-col lg:overflow-hidden lg:rounded-card lg:bg-dark lg:p-12 xl:p-16">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink text-accent lg:bg-accent lg:text-accentInk">
              <Route size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="text-lg font-semibold lg:text-xl lg:text-ondark">TravelTrack</span>
          </div>
          <Badge tone="accent">
            Plaksha
          </Badge>
        </div>

        {/* Hero */}
        <FadeIn className="mt-2 lg:mt-12 lg:w-full lg:max-w-xl lg:self-center" y={14}>
          <HeroRoute />
        </FadeIn>

        <FadeIn delay={0.08} className="lg:mx-auto lg:mb-auto lg:w-full lg:max-w-xl lg:pt-4">
          <h1 className="title mt-6 lg:mt-10 lg:text-5xl lg:text-ondark xl:text-6xl">
            Share the ride,
            <br />
            split the fare.
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-ink2 lg:mt-4 lg:text-lg lg:leading-7 lg:text-ondark2">
            Post a ride from anywhere to anywhere. People nearby heading the same way get asked to hop in.
          </p>
        </FadeIn>
        </div>

        {/* Actions, within thumb reach */}
        <FadeIn delay={0.14} className="mt-auto space-y-3 pb-2 pt-8 lg:mx-auto lg:mt-0 lg:w-full lg:max-w-md lg:self-center lg:px-4 lg:py-8">
          {error && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-between gap-3 rounded-input bg-danger/10 px-4 py-2 text-sm font-medium text-danger"
            >
              <span className="py-1.5">{error}</span>
              {offline && (
                <button type="button" onClick={loadMeta} className="press h-11 shrink-0 rounded-full px-3 font-semibold underline underline-offset-4">
                  Retry
                </button>
              )}
            </motion.div>
          )}

          {meta?.ms_client_id ? (
            <Button
              variant="dark"
              size="lg"
              full
              loading={busy === "microsoft"}
              disabled={busy !== null}
              icon={<MicrosoftLogo />}
              onClick={microsoft}
            >
              Sign in with Microsoft
            </Button>
          ) : meta && !meta.dev_login ? (
            <p className="rounded-input bg-soft px-4 py-3 text-sm text-ink2">Microsoft sign-in isn&apos;t set up on the server yet.</p>
          ) : !meta && !offline ? (
            <Button variant="dark" size="lg" full loading disabled aria-label="Loading sign-in">
              Sign in with Microsoft
            </Button>
          ) : null}

          <p className="text-center text-label text-ink3">Use your @{domain} Office 365 account.</p>

          {meta?.dev_login && (
            <form onSubmit={devLogin} className="space-y-3 rounded-card bg-surface p-4 shadow-card">
              <Field label="Dev login" aside={<span className="inline-flex items-center gap-1"><FlaskConical size={13} strokeWidth={1.75} aria-hidden />Local only</span>}>
                <Input
                  type="email"
                  required
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={`firstname.lastname@${meta.allowed_domain}`}
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                />
              </Field>
              <Button
                type="submit"
                full
                loading={busy === "dev"}
                disabled={busy !== null}
                iconRight={<ArrowRight size={18} strokeWidth={1.75} aria-hidden />}
              >
                Continue
              </Button>
            </form>
          )}
        </FadeIn>
      </PageTransition>
    </div>
  );
}

/** The Microsoft mark keeps its brand colours (the one place a screen holds literal colours). */
function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" className="h-[18px] w-[18px] shrink-0" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

// ---- animated route illustration ------------------------------------------------------

type Pt = [number, number];
const W = 320;
const H = 176;
/** Two joined cubic curves: pickup (bottom left) -> a rider on the way -> drop (top right). */
const SEGMENTS: [Pt, Pt, Pt, Pt][] = [
  [[34, 138], [104, 138], [96, 66], [160, 74]],
  [[160, 74], [224, 82], [222, 40], [286, 40]],
];
const PATH = SEGMENTS.map(([p0, c1, c2, p1], i) => `${i === 0 ? `M ${p0[0]} ${p0[1]} ` : ""}C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p1[0]} ${p1[1]}`).join(" ");

function cubic([p0, c1, c2, p1]: [Pt, Pt, Pt, Pt], t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]];
}

const STEPS = 12;
const TRACK: Pt[] = SEGMENTS.flatMap((seg, i) =>
  Array.from({ length: STEPS + (i === SEGMENTS.length - 1 ? 1 : 0) }, (_, k) => cubic(seg, k / STEPS)),
);
const START = TRACK[0];
const MID = SEGMENTS[0][3];
const END = TRACK[TRACK.length - 1];

const RIDERS = [
  { id: "hero-a", name: "Aanya Rao" },
  { id: "hero-b", name: "Kabir Singh" },
  { id: "hero-c", name: "Meher Gill" },
];

function pct(p: Pt): { left: string; top: string } {
  return { left: `${(p[0] / W) * 100}%`, top: `${(p[1] / H) * 100}%` };
}

/** Dark hero card: a route that draws itself, a cab travelling along it, and a ride filling up. */
function HeroRoute() {
  const reduce = useReducedMotion();
  const [taken, setTaken] = useState(1);

  // Seats fill one by one as "riders nearby" join.
  useEffect(() => {
    if (taken >= 3) return;
    const t = setTimeout(() => setTaken((n) => n + 1), taken === 1 ? 1700 : 1100);
    return () => clearTimeout(t);
  }, [taken]);

  const car = reduce ? MID : START;

  return (
    <div className="on-dark overflow-hidden rounded-card bg-dark p-4 text-ondark shadow-float lg:bg-white/[0.06] lg:p-6 lg:shadow-none" aria-hidden>
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" fill="none">
          {/* match radius around the rider on the way */}
          <motion.circle
            cx={MID[0]}
            cy={MID[1]}
            r={30}
            className="fill-warn"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={reduce ? { scale: 1, opacity: 0.16 } : { scale: [0.4, 1.25], opacity: [0.34, 0] }}
            transition={reduce ? { duration: 0.2 } : { duration: 2.2, ease: "easeOut", repeat: Infinity, delay: 1.2 }}
          />
          <circle cx={MID[0]} cy={MID[1]} r={30} className="stroke-warn" strokeWidth={1.5} strokeDasharray="3 6" opacity={0.45} />

          {/* dashed track, then the solid line drawing itself over it */}
          <path d={PATH} className="stroke-white/20" strokeWidth={2.5} strokeDasharray="2 8" strokeLinecap="round" />
          <motion.path
            d={PATH}
            className="stroke-accent"
            strokeWidth={2.5}
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          />

          {/* end points */}
          <circle cx={START[0]} cy={START[1]} r={6} className="fill-dark stroke-accent" strokeWidth={2.5} />
          <circle cx={END[0]} cy={END[1]} r={6} className="fill-accent" />

          {/* the cab */}
          <motion.g
            initial={{ x: car[0], y: car[1], opacity: reduce ? 1 : 0 }}
            animate={
              reduce
                ? { x: car[0], y: car[1], opacity: 1 }
                : { x: TRACK.map((p) => p[0]), y: TRACK.map((p) => p[1]), opacity: TRACK.map((_, i) => (i === 0 || i === TRACK.length - 1 ? 0 : 1)) }
            }
            transition={reduce ? { duration: 0 } : { duration: 4.2, ease: "linear", repeat: Infinity, repeatDelay: 0.9, delay: 0.5 }}
          >
            <circle r={15} className="fill-accent" />
            <Car x={-9} y={-9} size={18} strokeWidth={1.75} className="text-accentInk" />
          </motion.g>
        </svg>

        {/* labels over the drawing */}
        <HeroChip style={pct([START[0] + 4, START[1] + 14])} align="left" delay={0.5} icon={<Navigation size={12} strokeWidth={1.75} />}>
          From anywhere
        </HeroChip>
        <HeroChip style={pct([MID[0], MID[1] + 36])} align="center" delay={1.5} tone="warn">
          350 m away · join?
        </HeroChip>
        <HeroChip style={pct([END[0] - 2, END[1] - 36])} align="right" delay={1.1} icon={<MapPin size={12} strokeWidth={1.75} />}>
          To anywhere
        </HeroChip>
      </div>

      {/* the ride filling up */}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-inner bg-white/[0.06] p-3">
        <div className="min-w-0">
          <p className="tnum text-sm font-medium">17:30 · {taken} of 4 seats taken</p>
          <SeatDots taken={taken} total={4} tone="dark" size="md" className="mt-1.5" />
        </div>
        <AvatarStack users={RIDERS.slice(0, taken)} ring="dark" size="sm" />
      </div>
    </div>
  );
}

function HeroChip({
  children,
  style,
  align,
  delay,
  icon,
  tone = "dark",
}: {
  children: ReactNode;
  style: { left: string; top: string };
  align: "left" | "center" | "right";
  delay: number;
  icon?: ReactNode;
  tone?: "dark" | "warn";
}) {
  return (
    <span
      className={
        "absolute " + (align === "center" ? "-translate-x-1/2" : align === "right" ? "-translate-x-full" : "-translate-x-3")
      }
      style={style}
    >
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...SPRING_POP, delay }}
        className={
          "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 text-2xs font-medium " +
          (tone === "warn" ? "bg-warn text-warnInk" : "bg-white/10 text-ondark")
        }
      >
        {icon}
        {children}
      </motion.span>
    </span>
  );
}
