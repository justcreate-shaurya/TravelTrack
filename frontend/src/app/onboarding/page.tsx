"use client";

import { ArrowRight, MessageCircle, ShieldCheck, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AuthGate } from "@/components/AuthGate";
import { Avatar, Card, FadeIn, PageTransition, Stagger, StaggerItem } from "@/components/ui";
import { ROUTES } from "@/components/ui/AppShell";
import { firstName } from "@/lib/names";
import { useStore } from "@/lib/store";

import { ProfileForm } from "../(app)/profile/ProfileForm";

export default function OnboardingPage() {
  return (
    <AuthGate allowUnonboarded>
      <Onboarding />
    </AuthGate>
  );
}

function Point({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <StaggerItem as="li" className="flex items-center gap-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent">{icon}</span>
      <span className="text-sm text-ondark">{children}</span>
    </StaggerItem>
  );
}

function Onboarding() {
  const router = useRouter();
  const me = useStore((s) => s.me)!;
  const celebrate = useStore((s) => s.celebrate);
  // Decided once: saving flips `onboarded`, and that must not bounce a first-run user to /profile.
  const [alreadyOnboarded] = useState(me.onboarded);

  useEffect(() => {
    if (alreadyOnboarded) router.replace(ROUTES.profile);
  }, [alreadyOnboarded, router]);

  if (alreadyOnboarded) return null;

  const first = firstName(me.name) || "there";

  return (
    <div className="mx-auto min-h-dvh w-full max-w-phone bg-canvas text-ink lg:flex lg:max-w-none lg:flex-col">
      <PageTransition className="pt-safe pb-safe px-5 lg:flex lg:flex-1 lg:items-center lg:justify-center lg:px-8 lg:py-12">
        <div className="w-full lg:max-w-xl">
        <div className="flex items-center gap-3 pt-2">
          <Avatar name={me.name} seed={me.id} size="lg" />
          <div className="min-w-0">
            <p className="text-sm text-ink2">Welcome, {first}</p>
            <p className="truncate text-label text-ink3">{me.email}</p>
          </div>
        </div>
        <h1 className="title mt-5 lg:mt-8 lg:text-4xl">Set up your profile</h1>
        <p className="mt-2 text-[15px] leading-6 text-ink2">One quick step, then you can post and join rides.</p>

        <FadeIn delay={0.05} className="mt-5">
          <Card tone="dark" radius="card" pad="sm">
            <Stagger as="ul" className="space-y-3">
              <Point icon={<MessageCircle size={18} strokeWidth={1.75} aria-hidden />}>Riders in your ride can message you on WhatsApp</Point>
              <Point icon={<ShieldCheck size={18} strokeWidth={1.75} aria-hidden />}>Your number is never shown to anyone else</Point>
              <Point icon={<Wallet size={18} strokeWidth={1.75} aria-hidden />}>Add a UPI ID to get paid back when you book</Point>
            </Stagger>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1} className="mt-4 pb-4">
          <Card tone="surface">
            <ProfileForm
              me={me}
              submitLabel="Start riding"
              submitIcon={<ArrowRight size={20} strokeWidth={1.75} aria-hidden />}
              onSaved={() => {
                celebrate("You're all set");
                router.replace(ROUTES.home);
              }}
            />
          </Card>
        </FadeIn>
        </div>
      </PageTransition>
    </div>
  );
}
