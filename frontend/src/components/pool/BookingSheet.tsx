"use client";

import { IndianRupee } from "lucide-react";
import { useEffect, useState } from "react";

import { AnimatedNumber, Button, Field, Input, Pill, Sheet } from "@/components/ui";
import type { BookedVia, PoolDetail } from "@/lib/types";

import { BOOKED_VIA, rupees, seatWord } from "./util";

const MIN_FARE = 20;
const MAX_FARE = 20000;

export interface BookingSheetProps {
  open: boolean;
  onClose: () => void;
  pool: PoolDetail;
  /** The viewer's saved UPI ID; when missing the sheet asks for it. */
  upiId: string | null;
  busy: boolean;
  onConfirm: (input: { fare: number; via: BookedVia; upi: string | null }) => void;
}

/** "I booked the cab": which app, the fare, and what each seat comes to. */
export function BookingSheet({ open, onClose, pool, upiId, busy, onConfirm }: BookingSheetProps) {
  const [via, setVia] = useState<BookedVia>("uber");
  const [fareText, setFareText] = useState("");
  const [upi, setUpi] = useState("");

  useEffect(() => {
    if (open) {
      setFareText("");
      setUpi("");
    }
  }, [open]);

  const fare = Number.parseInt(fareText, 10);
  const hasFare = Number.isFinite(fare);
  const fareOk = hasFare && fare >= MIN_FARE && fare <= MAX_FARE;
  const fareError = hasFare && !fareOk ? `Enter a fare between ₹${MIN_FARE} and ₹${rupees(MAX_FARE)}` : null;
  const seats = Math.max(1, pool.seats_taken);
  const perSeat = fareOk ? Math.round((fare / seats) * 100) / 100 : 0;
  const needUpi = !upiId;
  const upiOk = !needUpi || /^[\w.\-]{2,}@[A-Za-z][\w.\-]*$/.test(upi.trim());

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title="Book the cab"
      description="Book it in your app, then enter the fare. Everyone gets their share to pay you."
      footer={
        <Button
          full
          size="lg"
          loading={busy}
          disabled={!fareOk || !upiOk}
          onClick={() => onConfirm({ fare, via, upi: needUpi ? upi.trim() : null })}
        >
          I&apos;ve booked it
        </Button>
      }
    >
      <div className="space-y-5 pb-5">
        <div>
          <p className="mb-2 px-1 text-label font-medium text-ink2" id="booked-via-label">
            Booked on
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="booked-via-label">
            {BOOKED_VIA.map((b) => (
              <Pill key={b.value} tone="soft" selected={via === b.value} onClick={() => setVia(b.value)} disabled={busy}>
                {b.label}
              </Pill>
            ))}
          </div>
        </div>

        <Field label="Total fare" error={fareError}>
          <Input
            leading={<IndianRupee size={18} strokeWidth={1.75} aria-hidden />}
            className="tnum text-xl font-semibold"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="480"
            autoComplete="off"
            value={fareText}
            disabled={busy}
            onChange={(e) => setFareText(e.target.value.replace(/\D/g, "").slice(0, 5))}
          />
        </Field>

        <div className="on-dark flex items-center justify-between gap-4 rounded-inner bg-dark p-4 text-ondark">
          <div>
            <p className="label">Each seat pays</p>
            <p className="mt-0.5 text-3xl font-semibold leading-9">
              <AnimatedNumber value={perSeat} format={(n) => `₹${rupees(n)}`} />
            </p>
          </div>
          <p className="tnum text-right text-sm text-ondark2">
            {fareOk ? `₹${rupees(fare)}` : "Fare"} split
            <br />
            across {seatWord(seats)}
          </p>
        </div>

        {needUpi && (
          <Field label="Your UPI ID" hint="Riders pay you back here. Saved to your profile." error={upi && !upiOk ? "That doesn't look like a UPI ID" : null}>
            <Input
              placeholder="name@bank"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={upi}
              disabled={busy}
              onChange={(e) => setUpi(e.target.value)}
            />
          </Field>
        )}
      </div>
    </Sheet>
  );
}
