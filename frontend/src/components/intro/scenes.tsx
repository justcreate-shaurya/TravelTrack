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

// ---------------------------------------------------------------- timing + motion

/** Seconds since the current scene started, read from the audio clock by the film. */
const SceneTime = createContext(0);
export const SceneTimeProvider = SceneTime.Provider;
const useT = () => useContext(SceneTime);

/** Big, bouncy overshoot for anything that lands on a beat. */
const BOUNCE = { type: "spring", stiffness: 520, damping: 15, mass: 0.9 } as const;
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

/** One headline: lines slam in on the beat, each word bouncing in a hair after the last. */
function Headline({
  lines,
  at = 0.1,
  step = 0.4,
  align = "left",
  size = "lg",
}: {
  lines: { text: string; tone?: Tone }[];
  at?: number;
  step?: number;
  align?: "left" | "center";
  size?: "lg" | "xl";
}) {
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
          {line.text.split(" ").map((word, j) => (
            <motion.span
              key={j}
              className="mr-[0.22em] inline-block last:mr-0"
              initial={{ opacity: 0, y: "70%", scale: 0.55, rotate: -6 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              transition={{ ...BOUNCE, delay: at + i * step + j * 0.05 }}
            >
              {word}
            </motion.span>
          ))}
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

/** Pops in on the beat with overshoot. */
function Pop({ at, children, className, from = 0.4 }: { at: number; children: ReactNode; className?: string; from?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, scale: from }} animate={{ opacity: 1, scale: 1 }} transition={{ ...BOUNCE, delay: at }}>
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------- 0. Intro

function IntroScene() {
  const t = useT();
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <AnimatePresence>
        {t < 3.85 && (
          <motion.div
            key="brand"
            className="flex flex-col items-center"
            exit={{ opacity: 0, scale: 1.6, filter: "blur(10px)", transition: { duration: 0.3 } }}
          >
            <motion.div
              className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#131816] shadow-[0_0_60px_-10px_rgba(122,240,154,0.6)] ring-1 ring-white/10"
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...BOUNCE, delay: 0.5 }}
            >
              <CarTaxiFront size={48} strokeWidth={1.75} color={MINT} />
            </motion.div>
            <motion.p
              className="mt-6 text-[clamp(1.4rem,3vw,2.2rem)] font-semibold tracking-[-0.02em] text-[#F1F5F0]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SOFT, delay: 0.9 }}
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
                transition={{ duration: 2.4, delay: 1.0, ease: [0.65, 0, 0.35, 1] }}
              />
              <motion.circle cx={30} cy={110} r={12} fill="none" stroke={MINT} strokeWidth={6} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...BOUNCE, delay: 1.0 }} />
              <motion.circle cx={970} cy={70} r={16} fill={MINT} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...BOUNCE, delay: 3.4 }} />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {t >= 3.85 && (
        <div className="px-6">
          <Headline
            align="center"
            size="xl"
            at={0.15}
            step={0.5}
            lines={[{ text: "Split the" }, { text: "cab.", tone: "mint" }]}
          />
          <motion.p
            className="mt-6 text-center text-[clamp(1.2rem,2.6vw,2rem)] font-semibold text-[#9BA59D]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SOFT, delay: 2.15 }}
          >
            Not the group chat.
          </motion.p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 1. The problem

const BUBBLES = [
  { name: "Riya", text: "anyone going to IXC at 5??", x: "0%", y: "2%", r: -3 },
  { name: "Arjun", text: "railway stn 4:30 anyone", x: "38%", y: "17%", r: 2 },
  { name: "Meera", text: "still need 1 more for the airport!!", x: "4%", y: "35%", r: 2 },
  { name: "Kabir", text: "wait which time again", x: "44%", y: "51%", r: -2 },
  { name: "Sana", text: "is the 5pm cab full?", x: "2%", y: "67%", r: -1 },
  { name: "Ishaan", text: "scroll up", x: "56%", y: "82%", r: 3 },
];

function ProblemScene() {
  const t = useT();
  const chaos = t < 3.5;
  const unread = Math.round(47 * easeOut(clamp01((t - 2.4) / 0.8)));
  return (
    <Split
      heading={
        chaos ? (
          <Headline key="chaos" lines={[{ text: "The group chat" }, { text: "is chaos.", tone: "yellow" }]} />
        ) : (
          <Headline key="calm" at={0.05} lines={[{ text: "One ride." }, { text: "Everyone on it.", tone: "mint" }]} />
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
                  exit={{ opacity: 0, scale: 0, x: "30%", y: "-20%", transition: { duration: 0.28, delay: i * 0.02 } }}
                  transition={{ ...BOUNCE, delay: 0.6 + i * 0.3 }}
                >
                  <p className="text-xs font-semibold" style={{ color: i % 2 ? YELLOW : MINT }}>
                    {b.name}
                  </p>
                  <p className="text-[15px] leading-snug">{b.text}</p>
                </motion.div>
              ))}
            {chaos && t >= 2.4 && (
              <motion.div
                key="unread"
                className="absolute -right-2 -top-4 flex items-center gap-1.5 rounded-full bg-[#F5B83D] px-3.5 py-1.5 text-sm font-bold text-[#3A2A00] shadow-lg"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 6 }}
                exit={{ scale: 0, transition: { duration: 0.2 } }}
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
              transition={{ ...BOUNCE, delay: 0.3 }}
            >
              <RideCardMock />
            </motion.div>
          )}
        </div>
      }
    />
  );
}

function RideCardMock({ joined = false }: { joined?: boolean }) {
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
        <RouteLine vehicle="sedan" animate="mount" delay={0.5} />
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
              style={{ background: i < 2 || joined ? MINT : "#E3E7E1" }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...BOUNCE, delay: 0.7 + i * 0.08 }}
            />
          ))}
        </div>
        <span className="rounded-full bg-[#7AF09A] px-4 py-2 text-sm font-bold text-[#062A12]">Join</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 2. Radius matching

function MatchScene() {
  const t = useT();
  const merged = t >= 2.6;
  const joined = t >= 4.65;
  return (
    <Split
      heading={<Headline lines={[{ text: "Matched within" }, { text: "2 km.", tone: "mint" }]} />}
      visual={
        <div className="relative w-[min(88vw,520px)]">
          <div
            className="relative h-[300px] overflow-hidden rounded-[28px] bg-[#0F1512] ring-1 ring-white/10"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
              backgroundSize: "34px 34px",
            }}
          >
            <svg viewBox="0 0 520 300" className="absolute inset-0 h-full w-full" aria-hidden>
              <path d="M -20 230 C 120 170, 200 250, 320 150 S 470 60, 560 90" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={22} strokeLinecap="round" />
            </svg>

            <AnimatePresence>
              {t >= 1.8 && !merged && (
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

            <MapPin2 label="You" color={MINT} at={0.6} left={merged ? "44%" : "20%"} top="52%" />
            <MapPin2 label="Aarav" color={YELLOW} at={1.0} left={merged ? "56%" : "74%"} top="40%" />

            {t >= 3.2 && (
              <motion.span
                className="absolute left-1/2 top-[46%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-4"
                style={{ borderColor: MINT }}
                initial={{ scale: 0.2, opacity: 1 }}
                animate={{ scale: 2.2, opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            )}
          </div>

          {t >= 3.4 && (
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
                animate={t >= 4.55 && t < 4.75 ? { scale: 0.86 } : { scale: 1 }}
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
      transition={{ y: { ...BOUNCE, delay: at }, opacity: { duration: 0.1, delay: at }, left: SOFT }}
    >
      <motion.span
        className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed"
        style={{ borderColor: color, opacity: 0.45 }}
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.08, 1] }}
        transition={{ duration: 0.7, delay: at + 0.4 }}
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

// ---------------------------------------------------------------- 3. Anywhere

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

function AnywhereScene() {
  return (
    <Split
      heading={<Headline step={0.5} lines={[{ text: "From anywhere." }, { text: "To anywhere.", tone: "mint" }]} />}
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
              transition={{ ...BOUNCE, delay: 1.0 + i * 0.15 }}
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

// ---------------------------------------------------------------- 4. Vehicle + seats

const CARS: { v: Vehicle; label: string; seats: number }[] = [
  { v: "auto", label: "Auto", seats: 3 },
  { v: "sedan", label: "Cab", seats: 4 },
  { v: "suv", label: "SUV", seats: 6 },
  { v: "muv", label: "MUV", seats: 7 },
];

function RideScene() {
  const t = useT();
  const picked = t >= 2.6 ? 2 : t >= 2.1 ? 1 : t >= 1.6 ? 0 : -1;
  const filled = t < 3.2 ? 0 : Math.min(5, 1 + Math.floor((t - 3.2) / 0.3));
  return (
    <Split
      heading={<Headline lines={[{ text: "Pick the car." }, { text: "Pick your seats.", tone: "mint" }]} />}
      visual={
        <div className="w-[min(88vw,520px)]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CARS.map((c, i) => (
              <Pop key={c.v} at={0.8 + i * 0.15} className="relative">
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
          </div>

          <Pop at={2.9} from={0.7} className="mt-6 rounded-[24px] bg-[#131816] p-5 ring-1 ring-white/10">
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
                  animate={{ background: i < filled ? MINT : "rgba(255,255,255,0.08)", scale: i === filled - 1 ? [1, 1.25, 1] : 1 }}
                  transition={{ duration: 0.35 }}
                />
              ))}
            </div>
          </Pop>
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------- 5. Ticket

function TicketScene() {
  return (
    <Split
      heading={<Headline lines={[{ text: "Your ride," }, { text: "as a ticket.", tone: "mint" }]} />}
      visual={
        <div className="w-[min(88vw,440px)] [perspective:1200px]">
          <motion.div
            className="relative rounded-[28px] bg-white p-6 text-[#0D1210] shadow-[0_40px_90px_-24px_rgba(0,0,0,0.75)]"
            initial={{ rotateX: 70, y: 120, opacity: 0 }}
            animate={{ rotateX: 0, y: 0, opacity: 1 }}
            transition={{ ...BOUNCE, stiffness: 300, damping: 18, delay: 0.2 }}
            style={{ transformOrigin: "50% 100%" }}
          >
            <p className="text-sm text-[#5A625C]">Your ride · Today</p>
            <div className="mt-3 flex items-end justify-between font-bold tabular-nums tracking-tight">
              <span className="text-4xl">17:00</span>
              <span className="text-2xl text-[#8E968F]">17:30</span>
            </div>
            <div className="mt-3">
              <RouteLine vehicle="suv" animate="mount" delay={0.7} size="md" />
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
                    transition={{ ...BOUNCE, delay: 1.4 + i * 0.15 }}
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

// ---------------------------------------------------------------- 6. Fare split

function SplitScene() {
  const t = useT();
  const fare = Math.round(280 * easeOut(clamp01((t - 0.8) / 1.0)));
  const paid = t >= 4.2;
  return (
    <Split
      heading={<Headline lines={[{ text: "Split it" }, { text: "in one tap.", tone: "mint" }]} />}
      visual={
        <Pop at={0.3} from={0.6} className="relative w-[min(88vw,460px)] rounded-[32px] bg-[#131816] p-7 text-[#F1F5F0] ring-1 ring-white/10">
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
              transition={{ duration: 1.0, delay: 0.8, ease: "easeOut" }}
            />
            {t >= 2.0 && (
              <motion.span
                className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold tabular-nums"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={BOUNCE}
              >
                ÷ 4 seats
              </motion.span>
            )}
            <motion.span
              className="h-1 flex-1 origin-left rounded-full"
              style={{ background: YELLOW }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: t >= 2.0 ? 1 : 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
            <span className="h-3 w-3 rounded-full" style={{ background: YELLOW }} />
          </div>

          {t >= 2.6 && (
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

          {t >= 3.2 && (
            <motion.div
              className="relative mt-6 flex items-center justify-center gap-2 rounded-full py-4 text-lg font-bold"
              style={{ background: paid ? "#0E1411" : MINT, color: paid ? MINT : "#062A12", boxShadow: paid ? `inset 0 0 0 2px ${MINT}` : "0 12px 32px -8px rgba(122,240,154,0.7)" }}
              initial={{ scale: 0, opacity: 0 }}
              animate={paid ? { scale: [0.9, 1.06, 1], opacity: 1 } : { scale: [1, 1.04, 1], opacity: 1 }}
              transition={paid ? { duration: 0.4 } : { scale: { duration: 0.5, repeat: Infinity }, opacity: { duration: 0.15 } }}
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
                      transition={{ duration: 0.8, ease: "easeOut" }}
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

// ---------------------------------------------------------------- 7. Live

const NOTES = [
  { icon: BellRing, color: YELLOW, title: "Leaving in 12m", body: "Meet at Plaksha main gate" },
  { icon: UserPlus, color: MINT, title: "Riya joined your ride", body: "4 of 6 seats taken" },
  { icon: Navigation, color: MINT, title: "New ride near you", body: "350 m away · leaving 18:30 · Join" },
];

function LiveScene() {
  return (
    <Split
      heading={<Headline step={0.3} lines={[{ text: "Live.", tone: "mint" }, { text: "Every seat," }, { text: "every second." }]} />}
      visual={
        <div className="flex w-[min(88vw,440px)] flex-col gap-3">
          {NOTES.map((n, i) => (
            <motion.div
              key={n.title}
              className="flex items-center gap-4 rounded-[22px] bg-white/95 p-4 text-[#0D1210] shadow-[0_20px_50px_-18px_rgba(0,0,0,0.7)] backdrop-blur"
              initial={{ opacity: 0, y: -60, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...BOUNCE, delay: 0.8 + i * 0.6 }}
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

// ---------------------------------------------------------------- 8. Outro

const TITLE = "TravelTrack";

function OutroScene() {
  const t = useT();
  return (
    <div className="relative flex h-full w-full items-center justify-center px-6">
      <AnimatePresence>
        {t < 1.95 && (
          <motion.p
            key="intro"
            className="text-[clamp(1.2rem,3vw,2.2rem)] font-semibold uppercase text-[#9BA59D]"
            initial={{ opacity: 0, letterSpacing: "0.1em" }}
            animate={{ opacity: 1, letterSpacing: "0.5em" }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
            transition={{ duration: 1.8, ease: "easeOut" }}
          >
            Introducing
          </motion.p>
        )}

        {t >= 1.95 && t < 3.95 && (
          <motion.div
            key="title"
            className="flex flex-col items-center"
            exit={{ opacity: 0, scale: 1.4, filter: "blur(14px)", transition: { duration: 0.3 } }}
          >
            <motion.div
              className="mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#7AF09A]"
              initial={{ scale: 0, rotate: 60 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...BOUNCE, delay: 0.3 }}
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
                  transition={{ ...BOUNCE, delay: i * 0.03 }}
                >
                  {ch}
                </motion.span>
              ))}
            </h2>
            <motion.p
              className="mt-5 text-center text-[clamp(1.1rem,2.4vw,1.8rem)] font-semibold text-[#9BA59D]"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SOFT, delay: 0.6 }}
            >
              Split the cab, not the group chat.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {t >= 3.95 && (
        <div className="relative flex flex-col items-center">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-[42%] h-[min(42vw,280px)] w-[min(42vw,280px)] -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ borderColor: i === 1 ? YELLOW : MINT }}
              initial={{ scale: 0.4, opacity: 0.9 }}
              animate={{ scale: 2.4 + i * 0.4, opacity: 0 }}
              transition={{ duration: 1.4, delay: 0.05 + i * 0.12, ease: "easeOut" }}
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
            transition={{ ...SOFT, delay: 0.9 }}
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
  /** Length in bars (one bar = 2s at 120 BPM). */
  bars: number;
  Comp: () => ReactNode;
  /** Sound cues, in seconds from the start of the scene. */
  cues: [number, Fx, number?][];
}

const pops = (from: number, n: number, gap: number, base = 1, rise = 0.12): [number, Fx, number?][] =>
  Array.from({ length: n }, (_, i) => [from + i * gap, "pop", base + i * rise] as [number, Fx, number]);

export const SCENES: SceneDef[] = [
  {
    key: "intro",
    bars: 4,
    Comp: IntroScene,
    cues: [[0.5, "pop", 0.8], [0.9, "tick"], [1.0, "whoosh", 0.8], [1.6, "riser", 2.4], [3.4, "pop", 1.4], [4.0, "impact"], [4.5, "slam"], [5.0, "slam"], [6.0, "whoosh", 0.5]],
  },
  {
    key: "problem",
    bars: 3,
    Comp: ProblemScene,
    cues: [[0, "whoosh", 0.4], [0.1, "slam"], [0.5, "slam"], ...pops(0.6, 6, 0.3), [2.4, "pop", 1.9], [3.4, "whoosh", 0.5], [3.55, "slam"], [3.8, "pop", 1.2], [3.95, "slam"]],
  },
  {
    key: "match",
    bars: 3,
    Comp: MatchScene,
    cues: [[0, "whoosh", 0.4], [0.1, "slam"], [0.5, "slam"], [0.75, "pop", 0.9], [1.15, "pop", 1.15], [1.8, "tick"], [2.6, "whoosh", 0.6], [3.2, "chime"], [3.4, "slam"], [4.55, "tick", 1.2], [4.7, "pop", 1.6]],
  },
  {
    key: "anywhere",
    bars: 2,
    Comp: AnywhereScene,
    cues: [[0, "whoosh", 0.4], [0.1, "slam"], [0.6, "slam"], ...Array.from({ length: 8 }, (_, i) => [1.0 + i * 0.15, "tick", 1 + i * 0.1] as [number, Fx, number])],
  },
  {
    key: "ride",
    bars: 3,
    Comp: RideScene,
    cues: [[0, "whoosh", 0.4], [0.1, "slam"], [0.5, "slam"], ...pops(0.8, 4, 0.15, 0.9), [1.6, "tick"], [2.1, "tick", 1.1], [2.6, "tick", 1.2], [2.9, "pop", 0.8], ...pops(3.2, 5, 0.3, 1, 0.1)],
  },
  {
    key: "ticket",
    bars: 2,
    Comp: TicketScene,
    cues: [[0, "whoosh", 0.5], [0.1, "slam"], [0.45, "slam"], [0.5, "slam"], [0.8, "whoosh", 0.6], ...pops(1.4, 4, 0.15, 1.1)],
  },
  {
    key: "split",
    bars: 3,
    Comp: SplitScene,
    cues: [
      [0, "whoosh", 0.4],
      [0.1, "slam"],
      [0.3, "pop", 0.8],
      [0.5, "slam"],
      ...Array.from({ length: 11 }, (_, i) => [0.8 + i * 0.1, "tick", 0.8 + i * 0.06] as [number, Fx, number]),
      [2.0, "pop", 1.2],
      [2.6, "slam"],
      [3.2, "pop", 1.4],
      [4.2, "cash"],
    ],
  },
  {
    key: "live",
    bars: 2,
    Comp: LiveScene,
    cues: [[0, "whoosh", 0.4], [0.1, "slam"], [0.4, "slam"], [0.7, "slam"], [0.8, "pop", 1.2], [1.4, "pop", 1.35], [2.0, "chime"]],
  },
  {
    key: "outro",
    bars: 5,
    Comp: OutroScene,
    cues: [[0, "riser", 2], [2.0, "impact"], [2.3, "pop", 1.3], [3.8, "whoosh", 0.3], [4.0, "impact"], [4.4, "chime"]],
  },
];

/** Flattens every scene's cues onto the film timeline. */
export function buildCues(barSeconds: number): { cues: Cue[]; starts: number[]; total: number } {
  const cues: Cue[] = [];
  const starts: number[] = [];
  let at = 0;
  for (const s of SCENES) {
    starts.push(at);
    for (const [t, fx, arg] of s.cues) cues.push({ t: at + t, fx, arg });
    at += s.bars * barSeconds;
  }
  return { cues, starts, total: at };
}
