"use client";

import type { ReactNode } from "react";

import { AuthGate } from "@/components/AuthGate";
import { CreateSheet } from "@/components/create/CreateSheet";
import { BottomNav, Sidebar } from "@/components/ui/AppShell";
import { useRealtime } from "@/lib/useRealtime";

/**
 * Shared chrome for every signed-in screen. It stays mounted across navigations, so the auth
 * check, the live socket, the navigation (bottom bar on phones, sidebar on desktop, with their
 * sliding pills) and the create wizard persist while only the page content transitions.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <Chrome>{children}</Chrome>
    </AuthGate>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  useRealtime();
  return (
    <>
      <Sidebar />
      {/* On desktop the sidebar is fixed, so the page area is pushed right by its width. */}
      <div className="lg:pl-[var(--sidebar-w)]">{children}</div>
      <BottomNav />
      <CreateSheet />
    </>
  );
}
