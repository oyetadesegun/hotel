"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Card, Chip, Field, Notice, OptionCard, cn, inputClass } from "./ui";
import { naira } from "@/src/lib/format";
import type { PublicSetup, Slot } from "@/src/lib/booking-engine";
import { deskBook, deskSlots, findMembers, type MemberHit } from "@/src/app/staff/booking-actions";

type Who = "member" | "resident" | "walkin";
const money = (kobo: number) => naira(Math.round(kobo) / 100);

/** Desk booking for members, resident guests and walk-ins. Slots and prices come from the server. */
export function DeskBooking({ setup, today, lastDay, initialWho = "member" }: { setup: PublicSetup; today: string; lastDay: string; initialWho?: Who }) {
  const [who, setWho] = useState<Who>(initialWho);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MemberHit[] | null>(null);
  const [member, setMember] = useState<MemberHit | null>(null);
  const [facilityId, setFacilityId] = useState(setup.facilities[0]?.id ?? "");
  const [day, setDay] = useState(today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [rentalIds, setRentalIds] = useState<string[]>([]);
  const [pay, setPay] = useState<"now" | "later">("now");
  const [method, setMethod] = useState("pos");
  const [error, setError] = useState("");
  const [searching, startSearch] = useTransition();
  const [loadingSlots, startSlots] = useTransition();
  const [saving, startSave] = useTransition();

  const facility = setup.facilities.find((f) => f.id === facilityId);
  const slot = slots?.find((s) => s.start === start) ?? null;
  const chosen = facility?.rentals.filter((r) => rentalIds.includes(r.id)) ?? [];
  const hours = (facility?.sessionMinutes ?? 60) / 60;
  const totalKobo = facility?.walkInRateKobo == null ? null : facility.walkInRateKobo + chosen.reduce((s, r) => s + r.rateKobo * hours, 0);

  // Member search as staff type.
  useEffect(() => {
    if (who !== "member" || member) return;
    const q = query.trim();
    let live = true;
    const t = setTimeout(() => {
      startSearch(async () => {
        const list = q.length >= 2 ? await findMembers(q) : null;
        if (live) setHits(list);
      });
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, who, member]);

  // Times for the chosen facility and day.
  useEffect(() => {
    if (!facilityId || !day) return;
    let live = true;
    startSlots(async () => {
      const list = await deskSlots(facilityId, day);
      if (live) setSlots(list);
    });
    return () => {
      live = false;
    };
  }, [facilityId, day]);

  if (!facility) return <Notice tone="warn">No facility is open for booking. An admin can open one under Facilities and rentals.</Notice>;

  function submit(fd: FormData) {
    if (!start) return setError("Please pick a time.");
    setError("");
    startSave(async () => {
      const r = await deskBook({
        who,
        membershipId: member?.membershipId,
        fullName: String(fd.get("fullName") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        email: String(fd.get("email") ?? ""),
        roomNumber: String(fd.get("roomNumber") ?? ""),
        facilityId,
        start,
        rentalIds,
        pay,
        method,
        receiptRef: String(fd.get("receiptRef") ?? ""),
      });
      // On success the action opens the new booking, so only errors come back.
      if (r?.error) {
        setError(r.error);
        if (/taken|pick|started/i.test(r.error)) {
          setStart(null);
          setSlots(await deskSlots(facilityId, day));
        }
      }
    });
  }

  const ready = start && (who !== "member" || member) && !(who === "walkin" && totalKobo == null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
      className="flex flex-col gap-4"
    >
      <Card className="max-w-4xl">
        <h2 className="text-base font-bold">1. Who is it for?</h2>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {(
            [
              ["member", "Member", "Free"],
              ["resident", "Resident guest", "Free"],
              ["walkin", "Walk-in", "Pays"],
            ] as const
          ).map(([id, title, hint]) => (
            <OptionCard key={id} name="who" checked={who === id} onChange={() => (setWho(id), setError(""))}>
              <b className="block">{title}</b>
              <span className="text-xs font-normal text-charcoal">{hint}</span>
            </OptionCard>
          ))}
        </div>

        {who === "member" &&
          (member ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3">
              <div>
                <b>{member.name}</b>
                <div className="text-xs text-charcoal">
                  {member.number} · {member.plan}
                  {member.endsOn ? ` · until ${member.endsOn}` : ""}
                  {member.phone ? ` · ${member.phone}` : ""}
                </div>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => (setMember(null), setQuery(""), setHits(null))}>
                Change
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Field
                label="Find the member"
                id="memberSearch"
                name=""
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, membership number or phone"
                autoComplete="off"
                className="basis-full"
              />
              {searching && <span className="text-xs text-charcoal">Searching…</span>}
              {hits && hits.length === 0 && !searching && <Notice>No active member matches “{query}”.</Notice>}
              {hits && hits.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {hits.map((h) => (
                    <li key={h.membershipId}>
                      <button type="button" onClick={() => setMember(h)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-left text-sm hover:bg-surface">
                        <span>
                          <b>{h.name}</b> <span className="text-charcoal">· {h.number}</span>
                        </span>
                        <span className="text-xs text-charcoal">{h.plan}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

        {who !== "member" && (
          <div className="flex flex-wrap gap-3.5">
            <Field label="Full name" id="fullName" required autoComplete="off" />
            {who === "resident" && <Field label="Room number" id="roomNumber" required className="basis-32" />}
            <Field label="Phone" id="phone" type="tel" required />
            <Field label="Email (optional)" id="email" type="email" hint="We send the booking code here." />
          </div>
        )}
        {who === "resident" && <p className="text-xs text-charcoal">Check their room key or the hotel system before booking. Booking at the desk counts as their stay being confirmed.</p>}
      </Card>

      <Card className="max-w-4xl">
        <h2 className="text-base font-bold">2. Facility and time</h2>
        <div className="flex flex-wrap gap-2">
          {setup.facilities.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={f.id === facilityId}
              onClick={() => (setFacilityId(f.id), setStart(null), setRentalIds([]), setSlots(null))}
              className={cn("h-10 rounded-full px-4 text-sm font-semibold", f.id === facilityId ? "bg-charcoal text-white" : "border-[1.5px] border-line hover:bg-surface")}
            >
              {f.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="day" className="text-[13px] font-semibold">
              Date
            </label>
            <input id="day" type="date" min={today} max={lastDay} value={day} onChange={(e) => (setDay(e.target.value), setStart(null), setSlots(null))} className={inputClass + " w-auto"} />
          </div>
          <span className="pb-3 text-xs text-charcoal">
            Open {facility.opens} to {facility.closes} · {facility.sessionMinutes}-minute sessions · up to {facility.maxSessionsPerDay} per person a day
          </span>
        </div>
        {loadingSlots || slots === null ? (
          <span className="text-sm text-charcoal">Loading times…</span>
        ) : slots.length === 0 ? (
          <Notice>No times on this day.</Notice>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {slots.map((s) => (
              <button
                key={s.start}
                type="button"
                disabled={s.state !== "free"}
                aria-pressed={start === s.start}
                onClick={() => (setStart(s.start), setError(""))}
                className={cn(
                  "flex h-12 flex-col items-center justify-center rounded-[10px] text-sm font-semibold",
                  s.state === "free" && start !== s.start && "border-[1.5px] border-line hover:bg-surface",
                  start === s.start && "bg-charcoal font-bold text-white",
                  s.state === "taken" && "bg-neutral-bg font-normal text-unavailable line-through",
                  s.state === "held" && "bg-warn-bg text-warn-fg",
                  s.state === "past" && "bg-surface font-normal text-unavailable",
                )}
              >
                {s.label}
                {s.state === "held" && <span className="text-[10px] font-normal">Held</span>}
              </button>
            ))}
          </div>
        )}
        {facility.rentals.length > 0 && (
          <fieldset className="flex flex-col gap-2 rounded-xl border-[1.5px] border-line px-3.5 py-3">
            <legend className="px-1 text-sm font-bold">Equipment</legend>
            {facility.rentals.map((r) => (
              <label key={r.id} className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={rentalIds.includes(r.id)}
                  onChange={(e) => setRentalIds((cur) => (e.target.checked ? [...cur, r.id] : cur.filter((x) => x !== r.id)))}
                />
                <span className="flex-1">{r.name}</span>
                <b>{money(r.rateKobo * hours)}</b>
              </label>
            ))}
            {who !== "walkin" && chosen.length > 0 && <span className="text-xs text-charcoal">Members and resident guests pay for equipment at the desk.</span>}
          </fieldset>
        )}
      </Card>

      {who === "walkin" && (
        <Card className="max-w-4xl">
          <h2 className="text-base font-bold">3. Payment</h2>
          {totalKobo == null ? (
            <Notice tone="warn">The walk-in price for {facility.name} is not set. An admin can set it under Facilities and rentals.</Notice>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
                <span className="text-sm">
                  {facility.name}, 1 session{chosen.length ? ` with ${chosen.map((r) => r.name.toLowerCase()).join(" and ")}` : ""}
                </span>
                <b className="text-lg">{money(totalKobo)}</b>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <OptionCard name="pay" checked={pay === "now"} onChange={() => setPay("now")}>
                  Paid now at the desk
                </OptionCard>
                <OptionCard name="pay" checked={pay === "later"} onChange={() => setPay("later")}>
                  Hold the slot, pays later
                  <span className="block text-xs font-normal text-charcoal">Released after {setup.holdUnpaidHours} hours if unpaid</span>
                </OptionCard>
              </div>
              {pay === "now" && (
                <div className="flex flex-wrap gap-3.5">
                  <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1.5">
                    <label htmlFor="method" className="text-[13px] font-semibold">
                      Paid by
                    </label>
                    <select id="method" value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                      <option value="pos">Card (POS)</option>
                      <option value="cash">Cash</option>
                      <option value="transfer">Bank transfer</option>
                    </select>
                  </div>
                  <Field label="Receipt or reference (optional)" id="receiptRef" />
                </div>
              )}
            </>
          )}
        </Card>
      )}

      <div className="flex max-w-4xl flex-col gap-3">
        {slot && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Chip tone="info">{facility.name}</Chip>
            <b>
              {new Date(slot.start).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" })}, {slot.label} to {slot.end}
            </b>
          </div>
        )}
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" size="md" disabled={!ready || saving} className="self-start">
          {saving ? "Booking…" : who === "walkin" && pay === "now" ? "Book and record payment" : "Book"}
        </Button>
      </div>
    </form>
  );
}
