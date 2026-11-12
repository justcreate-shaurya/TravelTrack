"use client";

import { ArrowRight, CarTaxiFront, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildCues, SCENES, SceneTimeProvider } from "./scenes";
import { BAR, BEAT, FilmAudio, type SongPlan } from "./sound";

const SONG: SongPlan = { drumsFrom: 2, drumsUntil: 22, busyFrom: 12, titleBar: 23, finalBar: 24 };
/** When the end buttons appear (the logo is fully revealed by then). */
const END_UI_AT = 50.5;

const BOUNCE = { type: "spring", stiffness: 520, damping: 15 } as const;

/** Background glow positions per scene, so the light drifts as the story moves. */
const GLOWS: [string, string][] = [
  ["50% 40%", "70% 80%"],
  ["20% 30%", "80% 70%"],
  ["75% 35%", "25% 75%"],
  ["30% 70%", "70% 25%"],
  ["70% 70%", "20% 30%"],
  ["25% 40%", "80% 60%"],
  ["60% 25%", "30% 80%"],
  ["80% 50%", "20% 50%"],
  ["50% 45%", "50% 60%"],
];

type Status = "idle" | "playing" | "ended";

/**
 * The TravelTrack reveal: a ~54s self-playing film with a synthesised soundtrack.
 * The audio clock is the master clock; the visuals read it every frame to pick the scene,
 * so cuts and hits stay on the beat. Space/Enter starts it, M mutes, R replays.
 */
export function IntroFilm() {
  const { cues, starts, total } = useMemo(() => buildCues(BAR), []);
  const totalBars = useMemo(() => SCENES.reduce((n, s) => n + s.bars, 0), []);

  const [status, setStatus] = useState<Status>("idle");
  const [t, setT] = useState(0);
  const [muted, setMuted] = useState(false);
  const audio = useRef<FilmAudio | null>(null);
  const raf = useRef<number | null>(null);
  const fallbackStart = useRef(0);

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    audio.current?.close();
    audio.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const play = useCallback(async () => {
    stop();
    setT(0);
    try {
      const a = new FilmAudio();
      await a.start(totalBars, cues, SONG);
      a.setMuted(muted);
      audio.current = a;
    } catch {
      audio.current = null; // no Web Audio: the film still plays, silently
    }
    fallbackStart.current = performance.now();
    setStatus("playing");
    const tick = () => {
      const now = audio.current ? audio.current.elapsed() : (performance.now() - fallbackStart.current) / 1000;
      if (now >= total) {
        setT(total);
        setStatus("ended");
        raf.current = null;
        return;
      }
      setT(now);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [cues, muted, stop, total, totalBars]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      audio.current?.setMuted(!m);
      return !m;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "m" || e.key === "M") toggleMute();
      else if ((e.key === "r" || e.key === "R") && status !== "idle") void play();
      else if ((e.key === " " || e.key === "Enter") && status === "idle") {
        e.preventDefault();
        void play();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play, status, toggleMute]);

  let index = 0;
  for (let i = 0; i < starts.length; i++) if (t >= starts[i]!) index = i;
  const scene = SCENES[index]!;
  const sceneT = t - starts[index]!;
  const glow = GLOWS[index] ?? GLOWS[0]!;

  // A soft pulse on every beat while the drums play.
  const drums = t >= SONG.drumsFrom * BAR && t < SONG.drumsUntil * BAR;
  const beatPhase = (t % BEAT) / BEAT;
  const pulse = drums ? 1 + 0.035 * (1 - beatPhase) ** 3 : 1;
  const showEnd = status === "ended" || (status === "playing" && t >= END_UI_AT);

  return (
    <MotionConfig reducedMotion="never">
      <div className="fixed inset-0 overflow-hidden bg-[#070A08] font-sans text-[#F1F5F0] selection:bg-[#7AF09A] selection:text-[#062A12]">
        {/* Ambient light that follows the story, breathing with the beat */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          animate={{
            background: `radial-gradient(42vmax 42vmax at ${glow[0]}, rgba(122,240,154,0.16), transparent 70%), radial-gradient(36vmax 36vmax at ${glow[1]}, rgba(245,184,61,0.10), transparent 70%)`,
          }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
          style={{ scale: pulse }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(circle at 50% 50%, black, transparent 75%)",
          }}
        />

        {status !== "idle" && (
          <SceneTimeProvider value={sceneT}>
            <AnimatePresence>
              <motion.section
                key={scene.key}
                className="absolute inset-0 flex items-center justify-center pb-10 pt-16"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.06, filter: "blur(8px)", transition: { duration: 0.28 } }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                aria-label={`Scene ${index + 1} of ${SCENES.length}`}
              >
                <scene.Comp />
              </motion.section>
            </AnimatePresence>
          </SceneTimeProvider>
        )}

        {/* Top bar: brand + sound */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] lg:px-10 lg:pt-8">
          <AnimatePresence>
            {status !== "idle" && index < SCENES.length - 1 && (
              <motion.span
                className="flex items-center gap-2 text-sm font-semibold text-[#9BA59D]"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <CarTaxiFront size={18} strokeWidth={2} color="#7AF09A" /> TravelTrack
              </motion.span>
            )}
          </AnimatePresence>
          <span />
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Turn sound on" : "Mute"}
            aria-pressed={muted}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[#F1F5F0] ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7AF09A]"
          >
            {muted ? <VolumeX size={20} strokeWidth={2} /> : <Volume2 size={20} strokeWidth={2} />}
          </button>
        </div>

        {/* Progress */}
        {status !== "idle" && (
          <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-white/5" aria-hidden>
            <div className="h-full origin-left bg-[#7AF09A]" style={{ transform: `scaleX(${Math.min(1, t / total)})` }} />
          </div>
        )}

        {/* Start screen */}
        <AnimatePresence>
          {status === "idle" && (
            <motion.div
              key="start"
              className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
              exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)", transition: { duration: 0.3 } }}
            >
              <motion.div
                className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#131816] ring-1 ring-white/10"
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ ...BOUNCE, delay: 0.1 }}
              >
                <CarTaxiFront size={32} strokeWidth={1.75} color="#7AF09A" />
              </motion.div>
              <motion.h1
                className="mt-6 text-[clamp(2.4rem,7vw,5rem)] font-bold leading-none tracking-[-0.045em]"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...BOUNCE, delay: 0.2 }}
              >
                Meet <span className="text-[#7AF09A]">TravelTrack</span>
              </motion.h1>
              <motion.p
                className="mt-4 max-w-md text-lg text-[#9BA59D]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                A one-minute reveal. Turn your sound on.
              </motion.p>
              <motion.button
                type="button"
                onClick={() => void play()}
                className="group relative mt-10 flex h-24 w-24 items-center justify-center rounded-full bg-[#7AF09A] text-[#062A12] shadow-[0_20px_60px_-10px_rgba(122,240,154,0.7)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#7AF09A]"
                aria-label="Play the TravelTrack reveal"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                transition={{ ...BOUNCE, delay: 0.55 }}
              >
                <motion.span
                  className="absolute inset-0 rounded-full border-2 border-[#7AF09A]"
                  animate={{ scale: [1, 1.6], opacity: [0.7, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                />
                <Play size={36} strokeWidth={2.4} className="ml-1.5" fill="currentColor" />
              </motion.button>
              <p className="mt-6 text-sm text-[#6C756E]">Space to play · M to mute</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* End buttons */}
        <AnimatePresence>
          {showEnd && (
            <motion.div
              key="end"
              className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-center gap-3 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={BOUNCE}
            >
              <button
                type="button"
                onClick={() => void play()}
                className="flex h-12 items-center gap-2 rounded-full bg-white/10 px-5 font-semibold ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/15"
              >
                <RotateCcw size={18} strokeWidth={2} /> Replay
              </button>
              <Link
                href="/"
                className="flex h-12 items-center gap-2 rounded-full bg-[#7AF09A] px-6 font-bold text-[#062A12] shadow-[0_12px_32px_-8px_rgba(122,240,154,0.7)]"
              >
                Open TravelTrack <ArrowRight size={18} strokeWidth={2.2} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </MotionConfig>
  );
}
