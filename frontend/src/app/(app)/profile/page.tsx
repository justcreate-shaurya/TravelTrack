"use client";

import { BellRing, GraduationCap, LogOut, Mail } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar, Badge, Button, Card, FadeIn, SPRING } from "@/components/ui";
import { AppShell, PageHeader, ROUTES } from "@/components/ui/AppShell";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { currentSubscription, disablePush, enablePush, pushSupported } from "@/lib/push";
import { useStore } from "@/lib/store";

import { ProfileForm } from "./ProfileForm";

export default function ProfilePage() {
  const router = useRouter();
  const me = useStore((s) => s.me)!;
  const logout = useStore((s) => s.logout);
  const showToast = useStore((s) => s.showToast);

  const signOut = () => {
    logout();
    router.replace(ROUTES.login);
  };

  return (
    <AppShell header={<PageHeader title="Profile" />}>
      <div className="lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-x-8">
      <div>
      <FadeIn className="mt-3">
        <Card tone="dark" className="flex items-center gap-4">
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING}>
            <Avatar name={me.name} seed={me.id} src={me.avatar_url} size="xl" />
          </motion.div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold leading-7 [overflow-wrap:anywhere]">{me.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-label text-ondark2">
              <Mail size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
              <span className="truncate">{me.email}</span>
            </p>
            {me.batch && (
              <Badge tone="onDark" size="sm" className="mt-2" icon={<GraduationCap size={13} strokeWidth={1.75} aria-hidden />}>
                Batch {me.batch}
              </Badge>
            )}
          </div>
        </Card>
      </FadeIn>

      <FadeIn className="mt-4" delay={0.05}>
        <Card tone="surface">
          <h2 className="mb-4 text-lg font-semibold">Your details</h2>
          <ProfileForm me={me} submitLabel="Save changes" requireChange onSaved={() => showToast("Profile saved", "success")} />
        </Card>
      </FadeIn>

      </div>

      <div className="lg:[&>:first-child]:mt-3">
      <PushSetting />

      <FadeIn className="mt-4" delay={0.15}>
        <Button variant="danger" size="lg" full icon={<LogOut size={20} strokeWidth={1.75} aria-hidden />} onClick={signOut}>
          Sign out
        </Button>
      </FadeIn>
      </div>
      </div>
    </AppShell>
  );
}

function PushSetting() {
  const meta = useStore((s) => s.meta);
  const showToast = useStore((s) => s.showToast);
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const vapid = meta?.vapid_public_key ?? null;

  useEffect(() => {
    setSupported(pushSupported());
    void useStore.getState().loadMeta();
    currentSubscription()
      .then((s) => setOn(!!s))
      .catch(() => {});
  }, []);

  if (!supported || !vapid) return null;

  const toggle = async () => {
    setBusy(true);
    haptic(8);
    try {
      if (on) {
        await disablePush();
        setOn(false);
        showToast("Reminders turned off");
      } else {
        const ok = await enablePush(vapid);
        setOn(ok);
        if (ok) showToast("Reminders turned on", "success");
        else showToast("Notifications are blocked in your browser settings", "error");
      }
    } catch {
      showToast("Couldn't update notifications", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FadeIn className="mt-4" delay={0.1}>
      <Card tone="surface" pad="sm" className="flex items-center gap-3">
        <span
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
            on ? "bg-accent/25 text-accentDeep" : "bg-soft text-ink2",
          )}
        >
          <BellRing size={20} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium" id="push-label">
            Ride reminders
          </p>
          <p className="text-label text-ink3">A nudge before your ride leaves, and when someone books the cab.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="push-label"
          disabled={busy}
          onClick={toggle}
          className="relative inline-flex h-11 w-14 shrink-0 items-center disabled:opacity-60"
        >
          <span className={cn("block h-8 w-14 rounded-full transition-colors duration-200", on ? "bg-accent" : "bg-ink/15")} aria-hidden />
          <motion.span
            className="absolute left-1 top-1/2 -mt-3 h-6 w-6 rounded-full bg-surface shadow-card"
            initial={false}
            animate={{ x: on ? 24 : 0 }}
            transition={SPRING}
            aria-hidden
          />
        </button>
      </Card>
    </FadeIn>
  );
}
