"use client";

import { ArrowLeft, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button, EmptyState, PageTransition, RouteLine, SuccessCheck } from "@/components/ui";
import { ROUTES } from "@/components/ui/AppShell";
import { api, ApiError } from "@/lib/api";
import { completeMicrosoftLogin, MsLoginError } from "@/lib/msauth";
import { useStore } from "@/lib/store";

export default function MicrosoftCallback() {
  const router = useRouter();
  const setAuth = useStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const ran = useRef(false); // StrictMode runs effects twice; the code can only be redeemed once

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const { idToken, nonce, next } = await completeMicrosoftLogin();
        const res = await api.microsoftLogin(idToken, nonce);
        setAuth(res.token, res.user);
        setDone(true);
        router.replace(res.user.onboarded ? next : ROUTES.onboarding);
      } catch (e) {
        setError(e instanceof MsLoginError || e instanceof ApiError ? e.message : "Sign-in failed");
      }
    })();
  }, [router, setAuth]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-phone flex-col bg-canvas lg:max-w-none text-ink">
      <PageTransition className="pt-safe pb-safe flex flex-1 flex-col justify-center px-5 lg:items-center lg:px-8">
        <div className="w-full lg:max-w-md">
        {error ? (
          <EmptyState
            icon={<ShieldAlert size={26} strokeWidth={1.75} />}
            title="Couldn't sign you in"
            body={<span role="alert">{error}</span>}
            action={
              <Button href={ROUTES.login} variant="dark" icon={<ArrowLeft size={18} strokeWidth={1.75} aria-hidden />}>
                Try again
              </Button>
            }
          />
        ) : (
          <div className="on-dark rounded-card bg-dark px-6 py-10 text-center text-ondark shadow-float" role="status" aria-busy={!done}>
            <div className="flex h-[88px] items-center justify-center">
              {done ? (
                <SuccessCheck size={72} />
              ) : (
                <div className="w-full px-2">
                  <RouteLine tone="dark" vehicle="sedan" animate="loop" size="lg" />
                </div>
              )}
            </div>
            <motion.p
              key={done ? "done" : "busy"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="mt-5 text-xl font-semibold"
            >
              {done ? "You're in" : "Signing you in"}
            </motion.p>
            <p className="mt-1 text-sm text-ondark2">{done ? "Taking you to your rides." : "Checking your Plaksha account with Microsoft."}</p>
          </div>
        )}
        </div>
      </PageTransition>
    </div>
  );
}
