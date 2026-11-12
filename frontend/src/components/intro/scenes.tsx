"use client";

import { BellRing, CarTaxiFront, Check, MapPin, MessageCircle, Navigation, UserPlus, Users, Wallet } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useContext, type ReactNode } from "react";

import { RouteLine } from "@/components/ui/RouteLine";
import { VehicleIcon } from "@/components/ui/VehicleIcon";
import { cn } from "@/lib/cn";
import type { Vehicle } from "@/lib/types";

import { Logo } from "./Logo";
import type { Cue, Fx } from "./sound";

/*
 * Every delay in this file is a measured hit in the track (see track.ts), written as seconds
 * from the start of its scene. Scene starts on the film timeline:
 *   intro 0.00 · problem 10.32 · match 16.82 · anywhere 24.83 · ride 29.50
 *   ticket 36.05 · split 39.80 · live 45.43 · outro 47.28 · end 57.00
 * The drop is at 6.08; breaks at 18.9–21.58 and 33.6–36.05; the last hit (logo) at 50.65.
 */

// ---------------------------------------------------------------- timing + motion

/** Seconds since the current scene started, read from the audio clock by the film. */
const SceneTime = createContext(0);
export const SceneTimeProvider = SceneTime.Provider;
const useT = () => useContext(SceneTime);

/** Big, bouncy overshoot for anything that lands on a hit. */
const BOUNCE = { type: "spring", stiffness: 560, damping: 15, mass: 0.85 } as const;
/** Softer spring for things that glide. */
const SOFT = { type: "spring", stiffness: 240, damping: 22 } as const;

const MINT = "#7AF09A";
const YELLOW = "#F5B83D";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);

type Tone = "white" | "mint" | "yellow" | "muted";
const TONE: Record<Tone, string> = {
  white: "text-[#F1F5F0]",
  mint: "text-[#7AF09A]",
  yellow: "text-[#F5B83D]",
  muted: "text-[#9BA59D]",
};

/**
 * A headline whose words slam in. By default each line lands `step` after the previous one;
 * `wordAt` pins every word (in reading order) to an exact time instead, for hits that matter.
 */
function Headline({
  lines,
  at = 0,
  step = 0.4,
  wordAt,
  align = "left",
  size = "lg",
}: {
  lines: { text: string; tone?: Tone }[];
  at?: number;
  step?: number;
  wordAt?: number[];
  align?: "left" | "center";
  size?: "lg" | "xl";
}) {
  let k = 0;
  return (
    <h2
      className={cn(
        "font-bold leading-[0.95] tracking-[-0.045em]",
        size === "xl" ? "text-[clamp(3rem,11vw,10rem)]" : "text-[clamp(2.4rem,6.4vw,6.2rem)]",
        align === "center" ? "text-center" : "text-center lg:text-left",
      )}
    >
      {lines.map((line, i) => (
        <span key={i} className={cn("block", TONE[line.tone ?? "white"])}>
          {line.text.split(" ").map((word, j) => {
            const delay = wordAt?.[k] ?? at + i * step + j * 0.05;
            k++;
            return (
              <motion.span
                key={j}
                className="mr-[0.22em] inline-block last:mr-0"
                initial={{ opacity: 0, y: "70%", scale: 0.5, rotate: -7 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                transition={{ ...BOUNCE, delay }}
              >
                {word}
              </motion.span>
            );
          })}
        </span>
      ))}
    </h2>
  );
}

/** Heading on the left and the visual on the right on desktop; stacked and centred on phones. */
function Split({ heading, visual }: { heading: ReactNode; visual: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[1180px] items-center gap-8 px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-12">
      <div>{heading}</div>
      <div className="flex justify-center">{visual}</div>
    </div>
  );
}

/** Pops in on a hit with overshoot. */
function Pop({ at, children, className, from = 0.4 }: { at: number; children: ReactNode; className?: string; from?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, scale: from }} animate={{ opacity: 1, scale: 1 }} transition={{ ...BOUNCE, delay: at }}>
      {children}
    </motion.div>
  );
}

/** A short squash-and-stretch kick on an element while `on` is true. */
const kick = (on: boolean) => (on ? { scale: 1.06 } : { scale: 1 });

// ---------------------------------------------------------------- 0. Intro (0.00 → 10.32): buildup, then the drop

const DROP = 5.95; // the brand clears just before the drop at 6.08

function IntroScene() {
  const t = useT();
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <AnimatePresence>
        {t < DROP && (
          <motion.div
            key="brand"
            className="flex flex-col items-center"
            exit={{ opacity: 0, scale: 1.7, filter: "blur(12px)", transition: { duration: 0.14 } }}
          >
            <motion.div
              className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#131816] shadow-[0_0_60px_-10px_rgba(122,240,154,0.6)] ring-1 ring-white/10"
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...BOUNCE, delay: 1.51 }}
            >
              <CarTaxiFront size={48} strokeWidth={1.75} color={MINT} />
            </motion.div>
            <motion.p
              className="mt-6 text-[clamp(1.4rem,3vw,2.2rem)] font-semibold tracking-[-0.02em] text-[#F1F5F0]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SOFT, delay: 3.03 }}
            >
              TravelTrack
            </motion.p>
            <svg viewBox="0 0 1000 160" className="mt-10 w-[min(88vw,900px)] overflow-visible" aria-hidden>
              <motion.path
                d="M 30 110 C 260 10, 420 170, 600 80 S 900 30, 970 70"
                fill="none"
                stroke={MINT}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray="1 18"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2.22, delay: 3.03, ease: [0.65, 0, 0.35, 1] }}
              />
              <motion.circle cx={30} cy={110} r={12} fill="none" stroke={MINT} strokeWidth={6} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...BOUNCE, delay: 3.03 }} />
              <motion.circle cx={970} cy={70} r={16} fill={MINT} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...BOUNCE, delay: 5.25 }} />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {t >= DROP && (
        <div className="px-6">
          {/* Split @6.08, the @6.56, cab. @7.97 (the two strongest kicks after the drop) */}
          <Headline align="center" size="xl" wordAt={[0.13, 0.61, 2.02]} lines={[{ text: "Split the" }, { text: "cab.", tone: "mint" }]} />
          <motion.p
            className="mt-6 text-center text-[clamp(1.2rem,2.6vw,2rem)] font-semibold text-[#9BA59D]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...BOUNCE, delay: 2.51 }}
          >
            Not the group chat.
          </motion.p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 1. The problem (10.32 → 16.82)

const BUBBLES = [
  { name: "Riya", text: "anyone going to IXC at 5??", x: "0%", y: "2%", r: -3 },
  { name: "Arjun", text: "railway stn 4:30 anyone", x: "38%", y: "17%", r: 2 },
  { name: "Meera", text: "still need 1 more for the airport!!", x: "4%", y: "35%", r: 2 },
  { name: "Kabir", text: "wait which time again", x: "44%", y: "51%", r: -2 },
  { name: "Sana", text: "is the 5pm cab full?", x: "2%", y: "67%", r: -1 },
  { name: "Ishaan", text: "scroll up", x: "56%", y: "82%", r: 3 },
];
const BUBBLE_AT = [0.93, 1.38, 1.84, 2.28, 2.74, 3.3]; // one per kick
const UNREAD_AT = 3.73;
const CALM_AT = 4.16;

function ProblemScene() {
  const t = useT();
  const chaos = t < CALM_AT;
  const unread = Math.round(47 * easeOut(clamp01((t - UNREAD_AT) / 0.4)));
  return (
    <Split
      heading={
        chaos ? (
          <Headline key="chaos" at={0} step={0.42} lines={[{ text: "The group chat" }, { text: "is chaos.", tone: "yellow" }]} />
        ) : (
          <Headline key="calm" at={0} step={0.52} lines={[{ text: "One ride." }, { text: "Everyone on it.", tone: "mint" }]} />
        )
      }
      visual={
        <div className="relative h-[360px] w-[min(88vw,500px)]">
          <AnimatePresence>
            {chaos &&
              BUBBLES.map((b, i) => (
                <motion.div
                  key={b.name}
                  className="absolute max-w-[62%] rounded-[20px] rounded-tl-md bg-[#1A221E] px-4 py-2.5 text-[#F1F5F0] shadow-xl ring-1 ring-white/5"
                  style={{ left: b.x, top: b.y }}
                  initial={{ opacity: 0, scale: 0.3, rotate: b.r * 4 }}
                  animate={{ opacity: 1, scale: 1, rotate: b.r }}
                  exit={{ opacity: 0, scale: 0, x: "30%", y: "-20%", transition: { duration: 0.22, delay: i * 0.015 } }}
                  transition={{ ...BOUNCE, delay: BUBBLE_AT[i] }}
                >
                  <p className="text-xs font-semibold" style={{ color: i % 2 ? YELLOW : MINT }}>
                    {b.name}
                  </p>
                  <p className="text-[15px] leading-snug">{b.text}</p>
                </motion.div>
              ))}
            {chaos && t >= UNREAD_AT && (
              <motion.div
                key="unread"
                className="absolute -right-2 -top-4 flex items-center gap-1.5 rounded-full bg-[#F5B83D] px-3.5 py-1.5 text-sm font-bold text-[#3A2A00] shadow-lg"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 6 }}
                exit={{ scale: 0, transition: { duration: 0.15 } }}
                transition={BOUNCE}
              >
                <MessageCircle size={16} strokeWidth={2.2} />
                <span className="tabular-nums">{unread} unread</span>
              </motion.div>
            )}
          </AnimatePresence>

          {!chaos && (
            <motion.div
              className="absolute inset-x-0 top-1/2 -translate-y-1/2"
              initial={{ opacity: 0, scale: 0.4, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ ...BOUNCE, delay: 0.52 }}
            >
              <RideCardMock />
            </motion.div>
          )}
        </div>
      }
    />
  );
}

function RideCardMock() {
  return (
    <div className="rounded-[28px] bg-white p-5 text-[#0D1210] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between text-sm text-[#5A625C]">
        <span className="font-semibold tabular-nums">Today · 17:00</span>
        <span className="rounded-full bg-[#F2F4EF] px-2.5 py-1 text-xs font-semibold">Cab · 4 seats</span>
      </div>
      <div className="mt-4 flex items-center justify-between text-2xl font-bold tabular-nums tracking-tight">
        <span>17:00</span>
        <span className="text-[#8E968F]">17:30</span>
      </div>
      <div className="mt-2">
        <RouteLine vehicle="sedan" animate="mount" delay={0.52} />
      </div>
      <div className="mt-2 flex justify-between text-sm font-medium">
        <span>Plaksha</span>
        <span>IXC Airport</span>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className="h-3.5 w-3.5 rounded-full"
              style={{ background: i < 2 ? MINT : "#E3E7E1" }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...BOUNCE, delay: 0.84 + i * 0.12 }}
            />
          ))}
        </div>
        <span className="rounded-full bg-[#7AF09A] px-4 py-2 text-sm font-bold text-[#062A12]">Join</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 2. Radius matching (16.82 → 24.83), across the first break

const PIN_YOU = 0.98;
const PIN_THEM = 1.41;
const DIST_AT = 1.92;
const GLIDE_AT = 3.4; // pins glide together through the break (18.9–21.58)...
const MERGE_AT = 4.76; // ...and snap together as the beat comes back
const CARD_AT = 5.21;
const PRESS_AT = 6.45;
const JOINED_AT = 6.6;

function MatchScene() {
  const t = useT();
  const merged = t >= GLIDE_AT;
  const joined = t >= JOINED_AT;
  return (
    <Split
      heading={<Headline at={0} step={0.55} lines={[{ text: "Matched within" }, { text: "2 km.", tone: "mint" }]} />}
      visual={
        <div className="relative w-[min(88vw,520px)]">
          <motion.div
            className="relative h-[300px] overflow-hidden rounded-[28px] bg-[#0F1512] ring-1 ring-white/10"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
              backgroundSize: "34px 34px",
            }}
            animate={kick(t >= MERGE_AT && t < MERGE_AT + 0.18)}
            transition={BOUNCE}
          >
            <svg viewBox="0 0 520 300" className="absolute inset-0 h-full w-full" aria-hidden>
              <path d="M -20 230 C 120 170, 200 250, 320 150 S 470 60, 560 90" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={22} strokeLinecap="round" />
            </svg>

            <AnimatePresence>
              {t >= DIST_AT && !merged && (
                <motion.div
                  key="dist"
                  className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold tabular-nums text-[#F1F5F0] backdrop-blur"
                  initial={{ opacity: 0, y: -10, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.18 } }}
                  transition={BOUNCE}
                >
                  1.4 km apart
                </motion.div>
              )}
            </AnimatePresence>

            <MapPin2 label="You" color={MINT} at={PIN_YOU} left={merged ? "44%" : "20%"} top="52%" />
            <MapPin2 label="Aarav" color={YELLOW} at={PIN_THEM} left={merged ? "56%" : "74%"} top="40%" />

            {t >= MERGE_AT && (
              <motion.span
                className="absolute left-1/2 top-[46%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-4"
                style={{ borderColor: MINT }}
                initial={{ scale: 0.2, opacity: 1 }}
                animate={{ scale: 2.4, opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            )}
          </motion.div>

          {t >= CARD_AT && (
            <motion.div
              className="absolute inset-x-4 -bottom-10 flex items-center gap-3 rounded-[22px] bg-white p-4 text-[#0D1210] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.7)]"
              initial={{ opacity: 0, y: 50, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={BOUNCE}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FDF0D3] font-bold text-[#3A2A00]">A</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold">Aarav is going your way</p>
                <p className="truncate text-sm text-[#5A625C]">17:00 · IXC Airport · 3 seats open</p>
              </div>
              <motion.span
                className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold"
                style={{ background: joined ? "#0E1411" : MINT, color: joined ? MINT : "#062A12" }}
                animate={t >= PRESS_AT && t < JOINED_AT + 0.08 ? { scale: 0.84 } : { scale: 1 }}
                transition={BOUNCE}
              >
                {joined ? (
                  <>
                    <Check size={16} strokeWidth={3} /> You&apos;re in
                  </>
                ) : (
                  "Join theirs"
                )}
              </motion.span>
            </motion.div>
          )}
        </div>
      }
    />
  );
}

function MapPin2({ label, color, at, left, top }: { label: string; color: string; at: number; left: string; top: string }) {
  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ top }}
      initial={{ left, y: -160, opacity: 0 }}
      animate={{ left, y: 0, opacity: 1 }}
      transition={{
        y: { ...BOUNCE, delay: at },
        opacity: { duration: 0.08, delay: at },
        // A slow, tense glide through the break, arriving as the beat returns.
        left: { duration: MERGE_AT - GLIDE_AT - 0.06, ease: [0.65, 0, 0.35, 1] },
      }}
    >
      <motion.span
        className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed"
        style={{ borderColor: color, opacity: 0.45 }}
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.08, 1] }}
        transition={{ duration: 0.5, delay: at + 0.43 }}
      />
      <div className="relative flex flex-col items-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg" style={{ background: color }}>
          <MapPin size={24} strokeWidth={2.2} color="#062A12" />
        </span>
        <span className="mt-1.5 rounded-full bg-[#0E1411] px-2.5 py-0.5 text-xs font-bold text-[#F1F5F0] ring-1 ring-white/10">{label}</span>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------- 3. Anywhere (24.83 → 29.50)

const CHIPS = [
  { label: "Plaksha", x: -38, y: -30 },
  { label: "IXC Airport", x: 30, y: -36 },
  { label: "Chandigarh Station", x: -10, y: 2 },
  { label: "Elante", x: 40, y: 6 },
  { label: "ISBT 43", x: -42, y: 30 },
  { label: "Sector 17", x: 20, y: 38 },
  { label: "Mohali Station", x: -14, y: 66 },
  { label: "Your hostel", x: 40, y: 70 },
];
const CHIP_AT = [0.9, 1.39, 1.89, 2.31, 2.79, 3.28, 3.77, 4.19]; // one per kick

function AnywhereScene() {
  return (
    <Split
      heading={<Headline at={0} step={0.48} lines={[{ text: "From anywhere." }, { text: "To anywhere.", tone: "mint" }]} />}
      visual={
        <div className="relative h-[360px] w-[min(88vw,520px)]">
          {CHIPS.map((c, i) => (
            <motion.span
              key={c.label}
              className={cn(
                "absolute left-1/2 top-[18%] flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-[15px] font-semibold shadow-lg",
                i % 3 === 0 ? "bg-[#7AF09A] text-[#062A12]" : "bg-white text-[#0D1210]",
              )}
              initial={{ opacity: 0, x: `${c.x * 6}%`, y: c.y * 6, scale: 0.3, rotate: c.x / 2 }}
              animate={{ opacity: 1, x: `${c.x * 2 - 50}%`, y: c.y * 3.3, scale: 1, rotate: c.x / 10 }}
              transition={{ ...BOUNCE, delay: CHIP_AT[i] }}
            >
              {i % 3 === 0 ? <Navigation size={16} strokeWidth={2.2} /> : <MapPin size={16} strokeWidth={2.2} />}
              {c.label}
            </motion.span>
          ))}
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------- 4. Vehicle + seats (29.50 → 36.05), seats fill through the second break

const CARS: { v: Vehicle; label: string; seats: number }[] = [
  { v: "auto", label: "Auto", seats: 3 },
  { v: "sedan", label: "Cab", seats: 4 },
  { v: "suv", label: "SUV", seats: 6 },
  { v: "muv", label: "MUV", seats: 7 },
];
const CARS_AT = 0.92;
const BIG_HIT = 1.41; // the hardest hit in the section (54.91 in the track)
const PICK_AT = [2.3, 2.8, 3.3]; // Auto → Cab → SUV
const PANEL_AT = 3.75;
const SEAT_AT = [4.1, 4.6, 5.1, 5.6, 6.1];

function RideScene() {
  const t = useT();
  const picked = t >= PICK_AT[2]! ? 2 : t >= PICK_AT[1]! ? 1 : t >= PICK_AT[0]! ? 0 : -1;
  const filled = SEAT_AT.filter((s) => t >= s).length;
  return (
    <Split
      heading={<Headline at={0} step={0.34} lines={[{ text: "Pick the car." }, { text: "Pick your seats.", tone: "mint" }]} />}
      visual={
        <div className="w-[min(88vw,520px)]">
          <motion.div className="grid grid-cols-2 gap-3 sm:grid-cols-4" animate={kick(t >= BIG_HIT && t < BIG_HIT + 0.16)} transition={BOUNCE}>
            {CARS.map((c, i) => (
              <Pop key={c.v} at={CARS_AT + i * 0.08} className="relative">
                {picked === i && (
                  <motion.span layoutId="film-pick" className="absolute -inset-1 rounded-[24px] ring-4 ring-[#7AF09A]" transition={BOUNCE} />
                )}
                <div className={cn("relative flex flex-col items-center gap-2 rounded-[20px] px-3 py-5", picked === i ? "bg-white text-[#0D1210]" : "bg-[#1A221E] text-[#F1F5F0]")}>
                  <VehicleIcon vehicle={c.v} size={36} />
                  <span className="text-base font-bold">{c.label}</span>
                  <span className="text-xs font-semibold opacity-60">{c.seats} seats</span>
                </div>
              </Pop>
            ))}
          </motion.div>

          <Pop at={PANEL_AT} from={0.7} className="mt-6 rounded-[24px] bg-[#131816] p-5 ring-1 ring-white/10">
            <div className="flex items-center justify-between text-[#F1F5F0]">
              <span className="flex items-center gap-2 text-base font-semibold">
                <Users size={20} strokeWidth={2} color={MINT} /> Seats
              </span>
              <span className="text-2xl font-bold tabular-nums">
                {filled} <span className="text-[#9BA59D]">of 6</span>
              </span>
            </div>
            <div className="mt-4 flex gap-2.5">
              {Array.from({ length: 6 }, (_, i) => (
                <motion.span
                  key={i}
                  className="h-7 flex-1 rounded-full"
                  animate={{ background: i < filled ? MINT : "rgba(255,255,255,0.08)", scale: i === filled - 1 ? [1, 1.3, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>
          </Pop>
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------- 5. Ticket (36.05 → 39.80), lands as the beat returns

const AVATAR_AT = [1.86, 2.35, 2.84, 3.25];

function TicketScene() {
  return (
    <Split
      heading={<Headline at={0} step={0.46} lines={[{ text: "Your ride," }, { text: "as a ticket.", tone: "mint" }]} />}
      visual={
        <div className="w-[min(88vw,440px)] [perspective:1200px]">
          <motion.div
            className="relative rounded-[28px] bg-white p-6 text-[#0D1210] shadow-[0_40px_90px_-24px_rgba(0,0,0,0.75)]"
            initial={{ rotateX: 70, y: 120, opacity: 0 }}
            animate={{ rotateX: 0, y: 0, opacity: 1 }}
            transition={{ ...BOUNCE, stiffness: 320, damping: 17, delay: 0.2 }}
            style={{ transformOrigin: "50% 100%" }}
          >
            <p className="text-sm text-[#5A625C]">Your ride · Today</p>
            <div className="mt-3 flex items-end justify-between font-bold tabular-nums tracking-tight">
              <span className="text-4xl">17:00</span>
              <span className="text-2xl text-[#8E968F]">17:30</span>
            </div>
            <div className="mt-3">
              <RouteLine vehicle="suv" animate="mount" delay={0.94} size="md" />
            </div>
            <div className="mt-2 flex justify-between text-base font-semibold">
              <span>Plaksha</span>
              <span>IXC Airport</span>
            </div>

            <div className="relative my-5 border-t-2 border-dashed border-[#E3E7E1]">
              <span className="absolute -left-9 -top-[13px] h-6 w-6 rounded-full bg-[#070A08]" />
              <span className="absolute -right-9 -top-[13px] h-6 w-6 rounded-full bg-[#070A08]" />
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              {[
                ["Pickup", "Main gate"],
                ["Vehicle", "SUV"],
                ["Seats", "5 of 6"],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[#8E968F]">{k}</p>
                  <p className="font-bold">{v}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div className="flex">
                {["A", "R", "K", "S"].map((n, i) => (
                  <motion.span
                    key={n}
                    className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ring-4 ring-white first:ml-0"
                    style={{ background: ["#C9F7D6", "#FDF0D3", "#DCE8FB", "#F6DCE6"][i] }}
                    initial={{ scale: 0, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ ...BOUNCE, delay: AVATAR_AT[i] }}
                  >
                    {n}
                  </motion.span>
                ))}
              </div>
              <span className="text-xs font-semibold tracking-[0.2em] text-[#8E968F]">TT-4F2A</span>
            </div>
          </motion.div>
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------- 6. Fare split (39.80 → 45.43)

const COUNT_FROM = 0.91;
const COUNT_FOR = 0.93;
const DIVIDE_AT = 2.37;
const EACH_AT = 3.75; // a big hit (67.55 in the track)
const PAY_AT = 4.22; // the biggest hit of the section (68.02)
const PAID_AT = 4.68;

function SplitScene() {
  const t = useT();
  const fare = Math.round(280 * easeOut(clamp01((t - COUNT_FROM) / COUNT_FOR)));
  const paid = t >= PAID_AT;
  return (
    <Split
      heading={<Headline at={0} step={0.46} lines={[{ text: "Split it" }, { text: "in one tap.", tone: "mint" }]} />}
      visual={
        <Pop at={0.46} from={0.6} className="relative w-[min(88vw,460px)] rounded-[32px] bg-[#131816] p-7 text-[#F1F5F0] ring-1 ring-white/10">
          <div className="flex items-center justify-between text-sm text-[#9BA59D]">
            <span className="flex items-center gap-2 font-semibold text-[#F1F5F0]">
              <Check size={18} strokeWidth={2.6} color={MINT} /> Cab booked
            </span>
            <span>Uber · 17:00</span>
          </div>

          <p className="mt-6 text-center text-[clamp(3.5rem,9vw,5.5rem)] font-bold leading-none tabular-nums tracking-tight">₹{fare}</p>

          <div className="mt-6 flex items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ background: YELLOW }} />
            <motion.span
              className="h-1 flex-1 origin-left rounded-full"
              style={{ background: YELLOW }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: COUNT_FOR, delay: COUNT_FROM, ease: "easeOut" }}
            />
            {t >= DIVIDE_AT && (
              <motion.span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold tabular-nums" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={BOUNCE}>
                ÷ 4 seats
              </motion.span>
            )}
            <motion.span
              className="h-1 flex-1 origin-left rounded-full"
              style={{ background: YELLOW }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: t >= DIVIDE_AT ? 1 : 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
            <span className="h-3 w-3 rounded-full" style={{ background: YELLOW }} />
          </div>

          {t >= EACH_AT && (
            <motion.p
              className="mt-6 text-center text-4xl font-bold"
              style={{ color: MINT }}
              initial={{ scale: 0.3, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={BOUNCE}
            >
              ₹70 each
            </motion.p>
          )}

          {t >= PAY_AT && (
            <motion.div
              className="relative mt-6 flex items-center justify-center gap-2 rounded-full py-4 text-lg font-bold"
              style={{ background: paid ? "#0E1411" : MINT, color: paid ? MINT : "#062A12", boxShadow: paid ? `inset 0 0 0 2px ${MINT}` : "0 12px 32px -8px rgba(122,240,154,0.7)" }}
              initial={{ scale: 0, opacity: 0 }}
              animate={paid ? { scale: [0.88, 1.08, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
              transition={paid ? { duration: 0.35 } : BOUNCE}
            >
              {paid ? (
                <>
                  <Check size={22} strokeWidth={3} /> Paid
                </>
              ) : (
                <>
                  <Wallet size={22} strokeWidth={2.2} /> Pay ₹70 by UPI
                </>
              )}
              {paid &&
                Array.from({ length: 12 }, (_, i) => {
                  const a = (i / 12) * Math.PI * 2;
                  return (
                    <motion.span
                      key={i}
                      className="absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full"
                      style={{ background: i % 2 ? MINT : YELLOW }}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{ x: Math.cos(a) * 170, y: Math.sin(a) * 90, opacity: 0, scale: 0.4 }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                    />
                  );
                })}
            </motion.div>
          )}
        </Pop>
      }
    />
  );
}

// ---------------------------------------------------------------- 7. Live (45.43 → 47.28): fast, three kicks

const NOTES = [
  { icon: BellRing, color: YELLOW, title: "Leaving in 12m", body: "Meet at Plaksha main gate" },
  { icon: UserPlus, color: MINT, title: "Riya joined your ride", body: "4 of 6 seats taken" },
  { icon: Navigation, color: MINT, title: "New ride near you", body: "350 m away · leaving 18:30 · Join" },
];
const NOTE_AT = [0.49, 0.87, 1.36];

function LiveScene() {
  return (
    <Split
      heading={<Headline at={0} step={0.18} lines={[{ text: "Live.", tone: "mint" }, { text: "Every seat," }, { text: "every second." }]} />}
      visual={
        <div className="flex w-[min(88vw,440px)] flex-col gap-3">
          {NOTES.map((n, i) => (
            <motion.div
              key={n.title}
              className="flex items-center gap-4 rounded-[22px] bg-white/95 p-4 text-[#0D1210] shadow-[0_20px_50px_-18px_rgba(0,0,0,0.7)] backdrop-blur"
              initial={{ opacity: 0, y: -60, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...BOUNCE, delay: NOTE_AT[i] }}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: n.color }}>
                <n.icon size={24} strokeWidth={2.2} color={n.color === YELLOW ? "#3A2A00" : "#062A12"} />
              </span>
              <div className="min-w-0">
                <p className="text-base font-bold">{n.title}</p>
                <p className="truncate text-sm text-[#5A625C]">{n.body}</p>
              </div>
              <span className="ml-auto self-start text-xs text-[#8E968F]">now</span>
            </motion.div>
          ))}
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------- 8. Outro (47.28 → 57.00): title on a hit, logo on the last hit

const TITLE = "TravelTrack";
const BADGE_AT = 0.49;
const TAGLINE_AT = 1.03; // a big hit (72.31)
const TITLE_OUT = 3.2;
const LOGO_AT = 3.37; // the track's last hit (74.65), then it goes quiet

function OutroScene() {
  const t = useT();
  return (
    <div className="relative flex h-full w-full items-center justify-center px-6">
      <AnimatePresence>
        {t < TITLE_OUT && (
          <motion.div
            key="title"
            className="flex flex-col items-center"
            exit={{ opacity: 0, scale: 1.4, filter: "blur(14px)", transition: { duration: 0.17 } }}
          >
            <motion.div
              className="mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#7AF09A]"
              initial={{ scale: 0, rotate: 60 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...BOUNCE, delay: BADGE_AT }}
            >
              <CarTaxiFront size={44} strokeWidth={2} color="#062A12" />
            </motion.div>
            <h2 className="text-[clamp(3.4rem,12vw,11rem)] font-bold leading-none tracking-[-0.05em] text-[#F1F5F0]">
              {TITLE.split("").map((ch, i) => (
                <motion.span
                  key={i}
                  className={cn("inline-block", i >= 6 && "text-[#7AF09A]")}
                  initial={{ opacity: 0, y: "80%", scale: 0.4 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ ...BOUNCE, delay: i * 0.025 }}
                >
                  {ch}
                </motion.span>
              ))}
            </h2>
            <motion.p
              className="mt-5 text-center text-[clamp(1.1rem,2.4vw,1.8rem)] font-semibold text-[#9BA59D]"
              initial={{ opacity: 0, y: 18, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...BOUNCE, delay: TAGLINE_AT }}
            >
              Split the cab, not the group chat.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {t >= LOGO_AT && (
        <div className="relative flex flex-col items-center">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-[42%] h-[min(42vw,280px)] w-[min(42vw,280px)] -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ borderColor: i === 1 ? YELLOW : MINT }}
              initial={{ scale: 0.4, opacity: 0.9 }}
              animate={{ scale: 2.4 + i * 0.4, opacity: 0 }}
              transition={{ duration: 1.4, delay: i * 0.12, ease: "easeOut" }}
            />
          ))}
          <motion.div
            className="absolute left-1/2 top-[42%] h-[min(60vw,420px)] w-[min(60vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(122,240,154,0.28), transparent 65%)" }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          <motion.div
            className="relative text-[#F1F5F0]"
            initial={{ scale: 0.2, rotate: -14, opacity: 0, filter: "blur(16px)" }}
            animate={{ scale: 1, rotate: 0, opacity: 1, filter: "blur(0px)" }}
            transition={{ ...BOUNCE, stiffness: 380, damping: 14 }}
          >
            <Logo className="h-[min(42vw,260px)] w-[min(42vw,260px)] drop-shadow-[0_0_40px_rgba(122,240,154,0.35)]" />
          </motion.div>
          <motion.p
            className="relative mt-6 text-sm font-semibold uppercase tracking-[0.4em] text-[#9BA59D]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SOFT, delay: 1.0 }}
          >
            TravelTrack · Made at Plaksha
          </motion.p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the running order

export interface SceneDef {
  key: string;
  /** Length in seconds, ending on a measured hit. */
  duration: number;
  Comp: () => ReactNode;
  /** Sound-effect accents, in seconds from the start of the scene. The track carries the beat. */
  cues: [number, Fx, number?][];
}

const at = (times: number[], fx: Fx, base = 1, rise = 0.1): [number, Fx, number?][] =>
  times.map((t, i) => [t, fx, base + i * rise] as [number, Fx, number]);

export const SCENES: SceneDef[] = [
  { key: "intro", duration: 10.32, Comp: IntroScene, cues: [[1.51, "pop", 0.8], [3.03, "tick"], [5.25, "pop", 1.4], [5.8, "whoosh", 0.3]] },
  {
    key: "problem",
    duration: 6.5,
    Comp: ProblemScene,
    cues: [...at(BUBBLE_AT, "pop", 1, 0.08), [UNREAD_AT, "pop", 1.9], [CALM_AT - 0.1, "whoosh", 0.35], [CALM_AT + 0.52, "pop", 1.2]],
  },
  {
    key: "match",
    duration: 8.01,
    Comp: MatchScene,
    cues: [[PIN_YOU, "pop", 0.9], [PIN_THEM, "pop", 1.15], [DIST_AT, "tick"], [GLIDE_AT, "whoosh", MERGE_AT - GLIDE_AT], [MERGE_AT, "chime"], [CARD_AT, "pop", 1.0], [PRESS_AT, "tick", 1.2], [JOINED_AT, "pop", 1.6]],
  },
  { key: "anywhere", duration: 4.67, Comp: AnywhereScene, cues: at(CHIP_AT, "tick", 1, 0.1) },
  {
    key: "ride",
    duration: 6.55,
    Comp: RideScene,
    cues: [...at([0, 1, 2, 3].map((i) => CARS_AT + i * 0.08), "pop", 0.9), ...at(PICK_AT, "tick", 1, 0.1), [PANEL_AT, "pop", 0.8], ...at(SEAT_AT, "pop", 1, 0.12)],
  },
  { key: "ticket", duration: 3.75, Comp: TicketScene, cues: [[0, "whoosh", 0.4], ...at(AVATAR_AT, "pop", 1.1)] },
  {
    key: "split",
    duration: 5.63,
    Comp: SplitScene,
    cues: [
      [0.46, "pop", 0.8],
      ...at(Array.from({ length: 10 }, (_, i) => COUNT_FROM + i * (COUNT_FOR / 10)), "tick", 0.8, 0.06),
      [DIVIDE_AT, "pop", 1.2],
      [EACH_AT, "pop", 1.5],
      [PAY_AT, "pop", 1.3],
      [PAID_AT, "cash"],
    ],
  },
  { key: "live", duration: 1.85, Comp: LiveScene, cues: [[NOTE_AT[0]!, "pop", 1.2], [NOTE_AT[1]!, "pop", 1.35], [NOTE_AT[2]!, "chime"]] },
  { key: "outro", duration: 9.72, Comp: OutroScene, cues: [[BADGE_AT, "pop", 1.3], [TITLE_OUT - 0.1, "whoosh", 0.25], [LOGO_AT + 0.25, "chime"]] },
];

/** Flattens every scene's cues onto the film timeline. */
export function buildCues(): { cues: Cue[]; starts: number[]; total: number } {
  const cues: Cue[] = [];
  const starts: number[] = [];
  let t0 = 0;
  for (const s of SCENES) {
    starts.push(t0);
    for (const [t, fx, arg] of s.cues) cues.push({ t: t0 + t, fx, arg });
    t0 = +(t0 + s.duration).toFixed(2);
  }
  return { cues, starts, total: t0 };
}
