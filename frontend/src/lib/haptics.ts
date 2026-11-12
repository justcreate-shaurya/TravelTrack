/** Short vibration where the device supports it (Android Chrome; a no-op on iOS and desktop). */
export function haptic(pattern: number | number[] = 12): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate(pattern);
  } catch {
    /* not allowed before a user gesture */
  }
}

/** The pattern used for success moments (posted, joined, booked, paid). */
export const SUCCESS_HAPTIC = [14, 40, 22];
