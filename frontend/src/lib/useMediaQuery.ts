"use client";

import { useEffect, useState } from "react";

/** Tracks a CSS media query. False on the server and on first paint, then updates. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** The desktop layout breakpoint (Tailwind `lg`). */
export const DESKTOP_QUERY = "(min-width: 1024px)";
export const useIsDesktop = () => useMediaQuery(DESKTOP_QUERY);
