"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

import { SuccessHost } from "./SuccessBurst";
import { Toast } from "./Toast";

/** Root client providers: motion honours the OS reduced-motion setting; the toast and success moment are mounted once. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toast />
      <SuccessHost />
    </MotionConfig>
  );
}
