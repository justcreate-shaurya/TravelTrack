"use client";

import { GraduationCap, UserRound, Wallet } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button, Field, Input } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Me } from "@/lib/types";

function displayPhone(p: string | null): string {
  if (!p) return "";
  return p.startsWith("91") && p.length === 12 ? `${p.slice(2, 7)} ${p.slice(7)}` : `+${p}`;
}

export interface ProfileFormProps {
  me: Me;
  submitLabel: string;
  /** Only enable the button once something changed (profile editing). */
  requireChange?: boolean;
  /** Icon on the right of the submit button. */
  submitIcon?: ReactNode;
  onSaved: (me: Me) => void;
}

/** Name, WhatsApp number, batch and UPI ID: shared by first-run setup and the profile screen. */
export function ProfileForm({ me, submitLabel, requireChange = false, submitIcon, onSaved }: ProfileFormProps) {
  const setMe = useStore((s) => s.setMe);
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(displayPhone(me.phone));
  const [batch, setBatch] = useState(me.batch ?? "");
  const [upi, setUpi] = useState(me.upi_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed =
    name.trim() !== me.name || phone.trim() !== displayPhone(me.phone) || batch !== (me.batch ?? "") || upi.trim() !== (me.upi_id ?? "");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateMe({ name: name.trim(), phone, batch: batch || null, upi_id: upi.trim() || null });
      setMe(updated);
      setPhone(displayPhone(updated.phone));
      onSaved(updated);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Name">
        <Input
          leading={<UserRound size={18} strokeWidth={1.75} aria-hidden />}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
          placeholder="Your name"
        />
      </Field>

      <Field label="WhatsApp number" hint="Only people in the same ride can see it">
        <Input
          leading={<span className="tnum text-base font-medium text-ink2">+91</span>}
          className="tnum !pl-14"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </Field>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
        <Field label="Batch" aside="Optional">
          <Input
            leading={<GraduationCap size={18} strokeWidth={1.75} aria-hidden />}
            className="tnum"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="2029"
            maxLength={4}
            value={batch}
            onChange={(e) => setBatch(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="UPI ID" aside="Optional">
          <Input
            leading={<Wallet size={18} strokeWidth={1.75} aria-hidden />}
            placeholder="name@bank"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
          />
        </Field>
      </div>
      <p className="px-1 text-label text-ink3">Your UPI ID is needed when you book the cab, so riders can pay you back.</p>

      {error && (
        <p role="alert" className="rounded-input bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <Button type="submit" full size="lg" loading={busy} disabled={requireChange && !changed} iconRight={submitIcon}>
        {submitLabel}
      </Button>
    </form>
  );
}
