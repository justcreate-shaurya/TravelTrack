/**
 * The film's music: "Bull" by Next Route (supplied as copyright-free; keep the licence with the project).
 * Film time 0 = TRACK_OFFSET seconds into the file. All scene timings in scenes.tsx were measured
 * against this file, so if the track or the offset changes, re-measure and retime the scenes.
 */

export const TRACK_URL = "/audio/bull-by-next-route.mp3";

/** Where in the track the film starts (seconds). The drop lands 6.08s into the film. */
export const TRACK_OFFSET = 24.0;

/** Film length (seconds). The track fades out from FADE_FROM to the end. */
export const FILM_LENGTH = 57.0;
export const FADE_FROM = 54.5;

/** When the Replay / Open buttons appear (the logo has landed on the track's last hit by then). */
export const END_UI_AT = 53.0;

/** Kick-drum hits measured in the track (track seconds). Drives the background's beat pulse. */
const TRACK_KICKS = [
  30.08, 30.56, 30.98, 31.38, 31.97, 32.46, 32.87, 33.33, 33.86, 34.32, 34.74, 35.25, 35.7, 36.16, 36.6, 37.06, 37.62, 38.05,
  38.48, 39.0, 39.49, 39.89, 40.27, 40.82, 41.37, 41.8, 42.23, 42.74, 42.93, 45.58, 46.03, 46.49, 46.89, 47.42, 47.76, 48.31,
  48.83, 49.31, 49.73, 50.22, 50.72, 51.14, 51.62, 52.11, 52.6, 53.02, 53.5, 53.84, 54.42, 54.91, 55.25, 55.8, 56.3, 56.8,
  57.25, 57.59, 60.05, 60.51, 60.99, 61.33, 61.91, 62.4, 62.89, 63.3, 63.8, 64.26, 64.71, 65.07, 65.64, 66.17, 66.54, 67.05,
  67.55, 68.02, 68.48, 68.82, 69.43, 69.92, 70.3, 70.79, 71.28, 71.77, 72.23, 72.63, 73.83, 74.65,
];

/** The same hits on the film's timeline. */
export const KICKS = TRACK_KICKS.map((t) => +(t - TRACK_OFFSET).toFixed(2));

/** Background pulse for film time t: a quick swell on each kick that decays. */
export function beatPulse(t: number): number {
  let last = -1;
  for (const k of KICKS) {
    if (k > t) break;
    last = k;
  }
  if (last < 0) return 1;
  const since = t - last;
  return since > 0.4 ? 1 : 1 + 0.04 * Math.exp(-since / 0.09);
}
