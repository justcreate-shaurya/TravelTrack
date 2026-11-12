"use client";

import { ChevronLeft, ChevronRight, CloudOff, LogOut, MessageCircle, RotateCw, Settings2, Share2, TicketX, UserPlus, Users, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { BookingSheet } from "@/components/pool/BookingSheet";
import { ConfirmSheet } from "@/components/pool/ConfirmSheet";
import { CreatorSheet } from "@/components/pool/CreatorSheet";
import { RidersList } from "@/components/pool/RidersList";
import { RideTicket, RideTicketSkeleton } from "@/components/pool/RideTicket";
import { SeatsSheet } from "@/components/pool/SeatsSheet";
import { SettlementCard } from "@/components/pool/SettlementCard";
import { firstName, rupees } from "@/components/pool/util";
import { Button, Card, Countdown, EmptyState, FadeIn, IconButton, SPRING } from "@/components/ui";
import { AppShell, PageHeader, ROUTES } from "@/components/ui/AppShell";
import { api, ApiError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { shortPlaceName } from "@/lib/geo";
import { useStore } from "@/lib/store";
import { dayLabel, hhmm } from "@/lib/time";
import type { BookedVia, Pool, PoolDetail, PoolUpdate, Settlement } from "@/lib/types";
import { useNow } from "@/lib/useNow";

type SheetKey = "seats" | "book" | "settings" | "leave" | "reopen" | null;

function BackButton() {
  return (
    <IconButton label="Back to rides" variant="onDark" href={ROUTES.home}>
      <ChevronLeft size={20} strokeWidth={1.75} />
    </IconButton>
  );
}

export default function PoolPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const now = useNow();
  const me = useStore((s) => s.me)!;
  const setMe = useStore((s) => s.setMe);
  const live = useStore((s) => s.pools[id]);
  const connected = useStore((s) => s.live);
  const presets = useStore((s) => s.presets);
  const upsertPool = useStore((s) => s.upsertPool);
  const removePool = useStore((s) => s.removePool);
  const showToast = useStore((s) => s.showToast);
  const celebrate = useStore((s) => s.celebrate);

  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [gone, setGone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [savingUser, setSavingUser] = useState<string | null>(null);
  const seenLive = useRef(false);
  const leaving = useRef(false); // our own leave removes the pool from the store; don't flash "closed"
  /** The store's copy as this page last wrote it; any other object there came from somewhere else. */
  const ownLive = useRef<Pool | undefined>(undefined);
  const hasPool = useRef(false);

  const apply = useCallback(
    (p: PoolDetail) => {
      hasPool.current = true;
      setFailed(false);
      setPool(p);
      upsertPool(p, true);
      ownLive.current = useStore.getState().pools[p.id];
    },
    [upsertPool],
  );

  const load = useCallback(() => {
    setFailed(false);
    api
      .pool(id)
      .then(apply)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setGone(true);
        // Nothing on screen yet: show the retry state. Otherwise the ride stays up and a toast is enough.
        else if (!hasPool.current) setFailed(true);
        else showToast(errorMessage(e, "Couldn't refresh this ride"), "error", { label: "Retry", onClick: () => load() });
      });
  }, [id, apply, showToast]);

  useEffect(load, [load]);

  // The store's copy changed and it was not this page that wrote it (a realtime broadcast, or a
  // board refresh): refetch the viewer-specific detail. Broadcasts are viewer-neutral, so fields
  // like the group chat link can only be picked up this way, whatever else did or did not change.
  useEffect(() => {
    if (live) {
      seenLive.current = true;
      if (hasPool.current && live !== ownLive.current) load();
    } else if (seenLive.current && !leaving.current) setGone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const meMember = pool?.members.find((m) => m.user.id === me.id);
  const isMember = !!meMember;

  // The split is only visible to riders, and changes whenever seats, fare or paid flags change.
  const splitKey =
    pool && pool.status === "booked" && isMember
      ? JSON.stringify([pool.total_fare, pool.booked_via, pool.members.map((m) => [m.user.id, m.seats, m.has_paid, m.is_booker])])
      : null;
  useEffect(() => {
    if (!splitKey) {
      setSettlement(null);
      return;
    }
    let stale = false;
    api
      .settlement(id)
      .then((s) => !stale && setSettlement(s))
      .catch((e) => !stale && showToast(errorMessage(e, "Couldn't load the split"), "error"));
    return () => {
      stale = true;
    };
  }, [splitKey, id, showToast]);

  /** Runs an action with the shared busy flag; errors become a toast. Resolves true on success. */
  const run = async (fn: () => Promise<void>, fallback = "Something went wrong"): Promise<boolean> => {
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (e) {
      showToast(errorMessage(e, fallback), "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (gone) {
    return (
      <AppShell tone="dark" nav={false} header={<PageHeader compact title="Ride" leading={<BackButton />} />}>
        <EmptyState
          className="mt-6 text-ink"
          icon={<TicketX size={26} strokeWidth={1.75} />}
          title="This ride has closed"
          body="It already left, or every rider dropped out."
          action={<Button href={ROUTES.home}>See other rides</Button>}
        />
      </AppShell>
    );
  }

  if (!pool && failed) {
    return (
      <AppShell tone="dark" nav={false} header={<PageHeader compact title="Ride" leading={<BackButton />} />}>
        <EmptyState
          className="mt-6 text-ink"
          icon={<CloudOff size={26} strokeWidth={1.75} />}
          title="Couldn't load this ride"
          body="Check your connection and try again."
          action={
            <Button icon={<RotateCw size={18} strokeWidth={1.75} aria-hidden />} onClick={load}>
              Try again
            </Button>
          }
        />
      </AppShell>
    );
  }

  if (!pool) {
    return (
      <AppShell tone="dark" nav={false} header={<PageHeader compact title="Ride" leading={<BackButton />} />}>
        <div className="mt-4">
          <RideTicketSkeleton />
        </div>
      </AppShell>
    );
  }

  const isCreator = pool.creator.id === me.id;
  const editable = pool.status === "open" || pool.status === "full";
  const booked = pool.status === "booked";
  const from = shortPlaceName(pool.origin, presets);
  const to = shortPlaceName(pool.destination, presets);
  const chatUrl = isMember ? (pool.whatsapp_group_url ?? pool.contact_url) : null;
  const chatLabel = pool.whatsapp_group_url ? "Open group chat" : `Message ${firstName(pool.creator.name)}`;
  const canBookNow = isMember && editable && (pool.can_book || now >= Date.parse(pool.bookable_at));
  const myLine = settlement?.lines.find((l) => l.user.id === me.id) ?? null;
  const iOwe = booked && !!myLine && settlement!.booker.id !== me.id && !myLine.has_paid;
  const soleRider = pool.members.length === 1;
  const canChangeSeats = isMember && editable && (pool.seats_open > 0 || meMember!.seats > 1);

  const confirmSeats = async (seats: number) => {
    const joining = !isMember;
    const ok = await run(
      async () => apply(joining ? await api.join(pool.id, seats) : await api.updateMySeats(pool.id, seats)),
      joining ? "Couldn't join the ride" : "Couldn't update your seats",
    );
    if (!ok) {
      load(); // the ride may have filled up meanwhile
      return;
    }
    setSheet(null);
    if (joining) celebrate("You're in");
    else showToast("Seats updated", "success");
  };

  const book = async (input: { fare: number; via: BookedVia; upi: string | null }) => {
    const ok = await run(async () => {
      if (input.upi) setMe(await api.updateMe({ upi_id: input.upi }));
      apply(await api.book(pool.id, input.fare, input.via));
    }, "Couldn't save the booking");
    if (ok) {
      setSheet(null);
      celebrate("Cab booked");
    }
  };

  const saveSettings = async (body: PoolUpdate) => {
    const ok = await run(async () => apply(await api.updatePool(pool.id, body)), "Couldn't save the changes");
    if (ok) {
      setSheet(null);
      showToast("Ride updated", "success");
    }
  };

  const reopen = async () => {
    const ok = await run(async () => apply(await api.unbook(pool.id)), "Couldn't reopen the ride");
    if (ok) {
      setSheet(null);
      showToast("Ride reopened");
    }
  };

  const leave = async () => {
    leaving.current = true;
    const ok = await run(async () => {
      const res = await api.leave(pool.id);
      if (res.deleted) removePool(pool.id);
      else if (res.pool) upsertPool(res.pool);
    }, "Couldn't leave the ride");
    if (ok) {
      setSheet(null);
      showToast(soleRider ? "Ride cancelled" : "You left the ride");
      router.replace(ROUTES.home);
    } else leaving.current = false;
  };

  const markPaid = async (userId: string, paid: boolean) => {
    setSavingUser(userId);
    try {
      setSettlement(await api.markPaid(pool.id, userId, paid));
      if (paid) celebrate(userId === me.id ? "Marked as paid" : "Payment noted");
      load();
    } catch (e) {
      showToast(errorMessage(e, "Couldn't update the payment"), "error");
    } finally {
      setSavingUser(null);
    }
  };

  const share = async () => {
    const url = window.location.href;
    const text = `${hhmm(pool.window_start)} ride from ${from} to ${to} on TravelTrack`;
    try {
      if (navigator.share) await navigator.share({ title: "TravelTrack ride", text, url });
      else {
        await navigator.clipboard.writeText(url);
        showToast("Link copied", "success");
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  // ---- sticky action bar: changes with the ride's state and who is looking ----
  const chatIcon = chatUrl && (
    <IconButton label={chatLabel} variant="onDark" size="lg" href={chatUrl} target="_blank">
      <MessageCircle size={22} strokeWidth={1.75} aria-hidden />
    </IconButton>
  );
  const chatButton = chatUrl && (
    <Button full size="lg" href={chatUrl} target="_blank" icon={<MessageCircle size={20} strokeWidth={1.75} aria-hidden />}>
      {chatLabel}
    </Button>
  );

  let bar: ReactNode = null;
  let barNote: ReactNode = null;
  if (!isMember) {
    if (pool.status === "open") {
      bar = (
        <Button full size="lg" icon={<UserPlus size={20} strokeWidth={1.75} aria-hidden />} onClick={() => setSheet("seats")}>
          Join ride
        </Button>
      );
    } else if (pool.status === "full") {
      bar = (
        <Button variant="onDark" full size="lg" disabled>
          This ride is full
        </Button>
      );
    }
  } else if (editable) {
    if (canBookNow) {
      bar = (
        <div className="flex items-center gap-2">
          {chatIcon}
          <Button full size="lg" className="min-w-0 flex-1" icon={<Wallet size={20} strokeWidth={1.75} aria-hidden />} onClick={() => setSheet("book")}>
            I&apos;ve booked the cab
          </Button>
        </div>
      );
      barNote = "Booked the cab? Add the fare and everyone gets their share.";
    } else {
      barNote = `Booking opens at ${hhmm(pool.bookable_at)}, or as soon as the ride is full.`;
      bar = chatButton || (
        <Button variant="onDark" full size="lg" disabled>
          Waiting for riders
        </Button>
      );
    }
  } else if (booked && iOwe && myLine?.upi_link) {
    bar = (
      <div className="flex items-center gap-2">
        {chatIcon}
        <Button full size="lg" className="min-w-0 flex-1" href={myLine.upi_link} icon={<Wallet size={20} strokeWidth={1.75} aria-hidden />}>
          Pay ₹{rupees(myLine.amount)} by UPI
        </Button>
      </div>
    );
    barNote = `Paid already? Tap "I've paid" in the split above.`;
  } else if (chatButton) {
    bar = chatButton;
  }

  const bottomBar = bar ? (
    <div>
      {barNote && <p className="mb-2 text-center text-label text-ondark2">{barNote}</p>}
      {bar}
    </div>
  ) : undefined;

  return (
    <AppShell
      tone="dark"
      nav={false}
      bottomBar={bottomBar}
      header={
        <PageHeader
          compact
          title={isMember ? "Your ride" : "Ride"}
          leading={<BackButton />}
          trailing={
            <IconButton label="Share this ride" variant="onDark" onClick={share}>
              <Share2 size={18} strokeWidth={1.75} />
            </IconButton>
          }
        />
      }
    >
      <div className="lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-10 lg:pt-2">
      {/* Left column on desktop: day and route above the ticket */}
      <div>
      <FadeIn className="mt-2">
        <div className="flex items-center justify-between gap-3">
          <p className="tnum text-sm text-ondark2">
            {dayLabel(pool.window_start)}, {hhmm(pool.window_start)}
          </p>
          <span className="flex items-center gap-1.5 text-label text-ondark2" role="status">
            <motion.span
              className={cn("h-2 w-2 rounded-full", connected ? "bg-accent" : "bg-white/30")}
              animate={connected ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
              transition={connected ? { duration: 2.4, ease: "easeInOut", repeat: Infinity } : { duration: 0.2 }}
              aria-hidden
            />
            {connected ? "Live" : "Offline"}
          </span>
        </div>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-2xl font-semibold leading-8 [overflow-wrap:anywhere] lg:text-3xl lg:leading-9">
            {from} to {to}
          </h2>
          {pool.status !== "departed" && <Countdown iso={pool.window_start} now={now} tone="dark" className="mt-0.5" />}
        </div>
      </FadeIn>

      <FadeIn className="mt-5" delay={0.06} y={14}>
        <RideTicket pool={pool} presets={presets} />
      </FadeIn>
      </div>

      {/* Right column on desktop: split, riders and ride controls */}
      <div className="lg:[&>:first-child]:mt-0">
      {isMember && booked && (
        <FadeIn className="mt-5" delay={0.1}>
          <SettlementCard
            pool={pool}
            settlement={settlement}
            meId={me.id}
            savingUser={savingUser}
            busy={busy}
            onMarkPaid={markPaid}
            onReopen={() => setSheet("reopen")}
          />
        </FadeIn>
      )}

      <FadeIn className="mt-7" delay={0.12}>
        <RidersList pool={pool} meId={me.id} />
      </FadeIn>

      {isMember && editable && (
        <FadeIn className="mt-5" delay={0.16}>
          <Card tone="surface" pad="none" className="space-y-1 p-2">
            {canChangeSeats && (
              <ManageRow
                icon={<Users size={20} strokeWidth={1.75} />}
                label="Change my seats"
                hint={`You hold ${meMember!.seats} seat${meMember!.seats === 1 ? "" : "s"}`}
                onClick={() => setSheet("seats")}
              />
            )}
            {isCreator && (
              <ManageRow
                icon={<Settings2 size={20} strokeWidth={1.75} />}
                label="Ride settings"
                hint={pool.whatsapp_group_url ? "Vehicle, seats, pickup point, group link" : "Add a WhatsApp group link for riders"}
                onClick={() => setSheet("settings")}
              />
            )}
            <ManageRow
              danger
              icon={<LogOut size={20} strokeWidth={1.75} />}
              label={soleRider ? "Cancel this ride" : "Leave ride"}
              hint={soleRider ? "Nobody else has joined yet" : "Your seats open up for others"}
              onClick={() => setSheet("leave")}
            />
          </Card>
        </FadeIn>
      )}

      {!isMember && !editable && (
        <p className="mt-6 text-center text-sm text-ondark2">
          {booked ? "The cab is booked, so this ride is no longer taking riders." : "This ride has already left."}
        </p>
      )}
      </div>
      </div>

      <SeatsSheet
        open={sheet === "seats"}
        onClose={() => setSheet(null)}
        pool={pool}
        presets={presets}
        mine={meMember?.seats ?? 0}
        busy={busy}
        onConfirm={confirmSeats}
      />
      <BookingSheet open={sheet === "book"} onClose={() => setSheet(null)} pool={pool} upiId={me.upi_id} busy={busy} onConfirm={book} />
      {isCreator && <CreatorSheet open={sheet === "settings"} onClose={() => setSheet(null)} pool={pool} busy={busy} onSave={saveSettings} />}
      <ConfirmSheet
        open={sheet === "leave"}
        onClose={() => setSheet(null)}
        title={soleRider ? "Cancel this ride?" : "Leave this ride?"}
        body={
          soleRider
            ? "You're the only rider, so the ride will be removed from the board."
            : "Your seats go back to the ride and the others are told right away."
        }
        confirmLabel={soleRider ? "Cancel ride" : "Leave ride"}
        cancelLabel="Stay"
        busy={busy}
        onConfirm={leave}
      />
      <ConfirmSheet
        open={sheet === "reopen"}
        onClose={() => setSheet(null)}
        title="Reopen this ride?"
        body="The booking, the fare split and everyone's paid marks are cleared. Riders can join or leave again."
        confirmLabel="Reopen"
        busy={busy}
        onConfirm={reopen}
      />
    </AppShell>
  );
}

function ManageRow({ icon, label, hint, danger, onClick }: { icon: ReactNode; label: string; hint?: string; danger?: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
      className="flex min-h-[64px] w-full items-center gap-3 rounded-inner px-3 py-2 text-left"
    >
      <span
        className={cn(
          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          danger ? "bg-danger/10 text-danger" : "bg-soft text-ink",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block font-medium", danger && "text-danger")}>{label}</span>
        {hint && <span className="block truncate text-label text-ink3">{hint}</span>}
      </span>
      <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink3" aria-hidden />
    </motion.button>
  );
}
