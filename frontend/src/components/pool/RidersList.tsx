"use client";

import { Check, MessageCircle } from "lucide-react";

import { Avatar, Badge, Card, Stagger, StaggerItem } from "@/components/ui";
import type { PoolDetail } from "@/lib/types";

import { firstName, seatWord } from "./util";

/** Everyone in the ride: seats held, booker / paid badges, and a WhatsApp link for fellow riders. */
export function RidersList({ pool, meId }: { pool: PoolDetail; meId: string }) {
  const contactFor = (uid: string) => pool.member_contacts?.find((c) => c.user_id === uid)?.wa_link ?? null;
  const booked = pool.status === "booked";

  return (
    <section aria-labelledby="riders-heading">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 id="riders-heading" className="text-lg font-semibold">
          Riders
        </h2>
        <p className="tnum text-label text-ondark2">
          {pool.members.length} {pool.members.length === 1 ? "person" : "people"} · {seatWord(pool.seats_taken)}
        </p>
      </div>
      <Card tone="surface" pad="none" className="p-2">
        <Stagger as="ul" className="space-y-1">
          {pool.members.map((m) => {
            const wa = m.user.id === meId ? null : contactFor(m.user.id);
            const isMe = m.user.id === meId;
            const facts = [seatWord(m.seats), m.user.batch && `Batch ${m.user.batch}`, m.user.id === pool.creator.id && "Posted this ride"]
              .filter(Boolean)
              .join(" · ");
            return (
              <StaggerItem as="li" key={m.user.id} className="flex min-h-[64px] items-center gap-3 rounded-inner px-3 py-2">
                <Avatar name={m.user.name} seed={m.user.id} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.user.name}
                    {isMe && <span className="font-normal text-ink3"> (you)</span>}
                  </p>
                  <p className="tnum truncate text-label text-ink3">{facts}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {m.is_booker ? (
                    <Badge tone="dark" size="sm">
                      Booker
                    </Badge>
                  ) : (
                    booked &&
                    m.has_paid && (
                      <Badge tone="accent" size="sm" icon={<Check size={12} strokeWidth={2.25} aria-hidden />}>
                        Paid
                      </Badge>
                    )
                  )}
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Message ${firstName(m.user.name)} on WhatsApp`}
                      className="press inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent/25 text-accentDeep"
                    >
                      <MessageCircle size={20} strokeWidth={1.75} aria-hidden />
                    </a>
                  )}
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </Card>
    </section>
  );
}
