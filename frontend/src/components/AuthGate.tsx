"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { useStore } from "@/lib/store";

/**
 * Renders children only for a signed-in, onboarded user.
 * Waits for mount so the persisted token (localStorage) never causes a hydration mismatch.
 * Once signed in it also warms the shared caches every screen needs: place presets and /meta.
 */
export function AuthGate({ children, allowUnonboarded = false }: { children: React.ReactNode; allowUnonboarded?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const token = useStore((s) => s.token);
  const me = useStore((s) => s.me);
  const setMe = useStore((s) => s.setMe);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    if (!token) {
      router.replace(`${ROUTES.login}?next=${encodeURIComponent(path)}`);
      return;
    }
    api.me().then(setMe).catch(() => {});
    const { loadPresets, loadMeta } = useStore.getState();
    void loadPresets();
    void loadMeta();
  }, [mounted, token, router, path, setMe]);

  useEffect(() => {
    if (mounted && token && me && !me.onboarded && !allowUnonboarded) router.replace(ROUTES.onboarding);
  }, [mounted, token, me, allowUnonboarded, router]);

  if (!mounted || !token || !me || (!me.onboarded && !allowUnonboarded)) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-phone items-center justify-center bg-canvas" role="status" aria-busy="true" aria-label="Loading">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-ink/10 border-t-accentDeep" aria-hidden />
      </div>
    );
  }
  return <>{children}</>;
}
