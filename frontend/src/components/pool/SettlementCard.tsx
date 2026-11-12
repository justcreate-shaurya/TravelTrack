"use client";

import { Check, CircleCheck, Copy, IndianRupee, RotateCcw } from "lucide-react";
import { motion } from "motion/react";

import { AnimatedNumber, Avatar, Badge, Button, Card, IconButton, RouteLine, Skeleton, SPRING, Stagger, StaggerItem } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { PoolDetail, Settlement } from "@/lib/types";

import { bookedViaLabel, firstName, rupees, seatWord } from "./util";

export interface SettlementCardProps {
  pool: PoolDetail;
  settlement: Settlement | null;
  meId: string;
  /** User id whose paid state is being saved, or null. */
  savingUser: string | null;
  busy: boolean;
  onMarkPaid: (userId: string, paid: boolean) => void;
  onReopen: () => void;
}

/**
 * The split after booking, as the dark "ride complete" card: total and seats at the ends,
 * the per-seat amount in the middle of a yellow line, then each rider's share.
 */
export function SettlementCard({ pool, settlement, meId, savingUser, busy, onMarkPaid, onReopen }: SettlementCardProps) {
  const showToast = useStore((s) => s.showToast);

  if (!settlement) {
    return (
      <Card tone="dark" className="border border-darkline" aria-label="Loading the split">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mx-auto mt-8 h-9 w-24" />
        <Skeleton className="mt-6 h-1.5 w-full" />
        <Skeleton className="mt-8 h-16 w-full rounded-inner" />
        <Skeleton className="mt-2 h-16 w-full rounded-inner" />
      </Card>
    );
  }

  const iAmBooker = settlement.booker.id === meId;
  const owing = settlement.lines.filter((l) => l.user.id !== settlement.booker.id);
  const paidCount = owing.filter((l) => l.has_paid).length;
  const allPaid = owing.length > 0 && paidCount === owing.length;
  const perSeat = Number(settlement.per_seat);

  const copyUpi = async () => {
    if (!settlement.booker_upi) return;
    try {
      await navigator.clipboard.writeText(settlement.booker_upi);
      showToast("UPI ID copied", "success");
    } catch {
      showToast("Couldn't copy. Long-press the UPI ID instead.", "error");
    }
  };

  return (
    <Card tone="dark" className="overflow-hidden border border-darkline">
      <span className="pointer-events-none absolute inset-0 bg-white/[0.04]" aria-hidden />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            Cab booked
            <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING, delay: 0.15 }} className="text-accent">
              <Check size={20} strokeWidth={2.25} aria-hidden />
            </motion.span>
          </h2>
          <Badge tone="onDark">{bookedViaLabel(settlement.booked_via)}</Badge>
        </div>

        {/* total · per seat · seats, on a line between two dots */}
        <div className="tnum mt-7 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <span className="text-sm text-ondark2">₹{rupees(settlement.total_fare)}</span>
          <span className="text-center text-[32px] font-semibold leading-9">
            <AnimatedNumber value={perSeat} format={(n) => `₹${rupees(n)}`} />
          </span>
          <span className="text-right text-sm text-ondark2">{seatWord(settlement.seats)}</span>
        </div>
        <RouteLine
          tone="dark"
          color="warn"
          variant="solid"
          size="lg"
          icon={<IndianRupee size={20} strokeWidth={1.75} />}
          className="mt-3"
          delay={0.1}
        />
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="truncate font-medium">Total fare</span>
          <Badge tone="onDark">per seat</Badge>
          <span className="truncate text-right font-medium">
            {owing.length === 0 ? (
              "Just you"
            ) : (
              <span className="tnum">
                <AnimatedNumber value={paidCount} /> of {owing.length} paid
              </span>
            )}
          </span>
        </div>

        {/* who paid the cab */}
        <div className="mt-6 flex items-center gap-3 rounded-inner bg-white/[0.06] p-3">
          <Avatar name={settlement.booker.name} seed={settlement.booker.id} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {iAmBooker ? "You paid the cab" : `${firstName(settlement.booker.name)} paid the cab`}
            </p>
            {settlement.booker_upi && <p className="truncate text-label text-ondark2">{settlement.booker_upi}</p>}
          </div>
          {settlement.booker_upi && !iAmBooker && (
            <IconButton label="Copy UPI ID" variant="onDark" onClick={copyUpi}>
              <Copy size={18} strokeWidth={1.75} aria-hidden />
            </IconButton>
          )}
        </div>

        {/* shares */}
        {owing.length > 0 && (
          <Stagger as="ul" className="mt-2 space-y-2">
            {owing.map((line) => {
              const isMe = line.user.id === meId;
              const canToggle = isMe || iAmBooker;
              const saving = savingUser === line.user.id;
              return (
                <StaggerItem as="li" key={line.user.id} className="flex min-h-[64px] items-center gap-3 rounded-inner bg-white/[0.06] p-3">
                  <Avatar name={line.user.name} seed={line.user.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{isMe ? "You" : line.user.name}</p>
                    <p className="tnum truncate text-label text-ondark2">
                      ₹{rupees(line.amount)} · {seatWord(line.seats)}
                    </p>
                  </div>
                  {line.has_paid ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge tone="accentSolid" icon={<Check size={13} strokeWidth={2.25} aria-hidden />}>
                        Paid
                      </Badge>
                      {canToggle && (
                        <Button
                          variant="onDark"
                          size="sm"
                          disabled={saving || busy}
                          aria-label={`Mark ${isMe ? "yourself" : firstName(line.user.name)} as not paid`}
                          onClick={() => onMarkPaid(line.user.id, false)}
                        >
                          Undo
                        </Button>
                      )}
                    </div>
                  ) : canToggle ? (
                    <Button
                      variant={iAmBooker ? "primary" : "onDark"}
                      size="sm"
                      disabled={saving || busy}
                      aria-busy={saving || undefined}
                      onClick={() => onMarkPaid(line.user.id, true)}
                    >
                      {isMe ? "I've paid" : "Mark paid"}
                    </Button>
                  ) : (
                    <Badge tone="warn">Due</Badge>
                  )}
                </StaggerItem>
              );
            })}
          </Stagger>
        )}

        {allPaid && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-accent"
          >
            <CircleCheck size={18} strokeWidth={1.75} aria-hidden />
            Everyone has paid
          </motion.p>
        )}

        {iAmBooker && pool.status === "booked" && (
          <div className="mt-5">
            <Button variant="onDark" size="sm" full icon={<RotateCcw size={16} strokeWidth={1.75} aria-hidden />} disabled={busy} onClick={onReopen}>
              Reopen ride
            </Button>
            <p className="mt-2 text-center text-label text-ondark2">Wrong fare or the cab cancelled? Reopening clears the split.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
