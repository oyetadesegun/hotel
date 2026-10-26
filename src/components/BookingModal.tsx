"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Clock3, Info, Lock, ShieldCheck, X } from "lucide-react";
import { naira } from "@/src/lib/format";
import type { PublicSetup, Slot } from "@/src/lib/booking-engine";
import { bookOnline, checkMember, getSlots, type OnlineResult } from "@/src/app/book-actions";
import type { CurrentUser } from "@/src/app/session-actions";

type Who = "member" | "resident" | "walkin";
type Step = "who" | "slot" | "details" | "done";

const whoChoices: { id: Who; title: string; hint: string }[] = [
  { id: "member", title: "Member", hint: "Use your membership number" },
  { id: "resident", title: "Resident guest", hint: "Use your room number and last name" },
  { id: "walkin", title: "Walk-in or visitor", hint: "Pay online to confirm your booking" },
];

/** The next `n` days in Lagos, as YYYY-MM-DD with labels for the date pills. */
function lagosDays(n: number) {
  const iso = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const today = new Date(`${iso(new Date())}T12:00:00+01:00`);
  return Array.from({ length: Math.max(1, n) }, (_, i) => {
    const d = new Date(today.getTime() + i * 86_400_000);
    const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", ...o });
    return { iso: iso(d), dow: i === 0 ? "Today" : f({ weekday: "short" }), label: f({ day: "numeric", month: "short" }), long: f({ weekday: "short", day: "numeric", month: "short" }) };
  });
}

const money = (kobo: number) => naira(Math.round(kobo) / 100);

/**
 * The customer booking flow as a popup over the landing page:
 * who is booking, pick a facility and time (live from the database), your details, booked.
 * Members and resident guests book free. Walk-ins pay online.
 */
export function BookingModal({
  setup,
  me,
  facilityId,
  onFacilityChange,
  onClose,
}: {
  setup: PublicSetup;
  /** The signed-in person (undefined while loading). Members with an active membership skip "Who is booking". */
  me: CurrentUser | null | undefined;
  facilityId: string;
  onFacilityChange: (id: string) => void;
  onClose: () => void;
}) {
  const [rawStep, setStep] = useState<Step>("who");
  const [chosenWho, setWho] = useState<Who>("member");
  const signedIn = me?.kind === "member" && me.memberNumber ? { name: me.name, memberNumber: me.memberNumber } : null;
  // A signed-in member always books as themselves, straight from picking a time.
  const step: Step = signedIn && rawStep === "who" ? "slot" : rawStep;
  const who: Who = signedIn ? "member" : chosenWho;
  const [memberNumber, setMemberNumber] = useState("");
  const [lastName, setLastName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState(false);
  const [day, setDay] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [rentalIds, setRentalIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Extract<OnlineResult, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();
  const [loadingSlots, startLoadingSlots] = useTransition();

  const facility = setup.facilities.find((f) => f.id === facilityId) ?? setup.facilities[0];
  const days = useMemo(() => lagosDays(facility?.bookAheadDays ?? 1), [facility?.bookAheadDays]);
  const activeDay = days.some((d) => d.iso === day) ? day : days[0].iso;
  const slot = slots?.find((s) => s.start === start) ?? null;
  const chosen = facility?.rentals.filter((r) => rentalIds.includes(r.id)) ?? [];
  const hours = (facility?.sessionMinutes ?? 60) / 60;
  const rentalKobo = chosen.reduce((sum, r) => sum + r.rateKobo * hours, 0);
  const totalKobo = facility?.walkInRateKobo == null ? null : facility.walkInRateKobo + rentalKobo;
  const dayLabel = days.find((d) => d.iso === activeDay)?.long ?? "";
  const when = slot ? `${dayLabel}, ${slot.label} to ${slot.end}` : "";
  const stepsTotal = signedIn ? 2 : 3;
  const stepNo = (n: number) => (signedIn ? n - 1 : n);

  // Close on Escape and stop the page scrolling behind the popup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Live times for the chosen facility and day.
  useEffect(() => {
    if (step !== "slot" || !facility) return;
    let live = true;
    startLoadingSlots(async () => {
      const list = await getSlots(facility.id, activeDay);
      if (live) setSlots(list);
    });
    return () => {
      live = false;
    };
  }, [step, facility, activeDay]);

  if (!facility) {
    return (
      <Shell onClose={onClose}>
        <h2 id="booking-title">No facilities open.</h2>
        <p className="modal-intro">Nothing can be booked online right now. Please contact the Recreation desk.</p>
      </Shell>
    );
  }

  function pickFacility(id: string) {
    onFacilityChange(id);
    setRentalIds([]);
    setStart(null);
    setSlots(null);
  }

  function pickDay(iso: string) {
    setDay(iso);
    setStart(null);
    setSlots(null);
  }

  function continueFromWho() {
    setError("");
    if (who !== "member") return setStep("slot");
    startTransition(async () => {
      const r = await checkMember(memberNumber);
      if ("error" in r) return setError(r.error);
      setMemberName(r.name);
      setStep("slot");
    });
  }

  function book() {
    if (!start) return;
    setError("");
    startTransition(async () => {
      const r = await bookOnline({
        who,
        memberNumber: who === "member" && !signedIn ? memberNumber : undefined,
        lastName,
        roomNumber: room,
        fullName: name,
        phone,
        email,
        facilityId: facility.id,
        start,
        rentalIds,
        acceptTerms: terms,
      });
      if ("error" in r) {
        setError(r.error);
        // The time may have gone: show fresh times.
        if (/taken|pick|started/i.test(r.error)) {
          setStart(null);
          setSlots(await getSlots(facility.id, activeDay));
          setStep("slot");
        }
        return;
      }
      setResult(r);
      setStep("done");
    });
  }

  function bookAnother() {
    setStart(null);
    setRentalIds([]);
    setTerms(false);
    setResult(null);
    setSlots(null);
    setStep("slot");
  }

  const back = (to: Step) => (
    <button className="modal-back" type="button" onClick={() => (setError(""), setStep(to))}>
      <ArrowLeft size={14} /> BACK
    </button>
  );
  const errorBox = error && (
    <p className="booking-notice bad" role="alert">
      <AlertCircle size={14} /> {error}
    </p>
  );

  const whoReady =
    who === "walkin" || (who === "resident" ? room.trim() && lastName.trim() : memberNumber.trim());
  const detailsReady =
    terms && (who === "member" || (who === "resident" ? phone.trim() : name.trim() && phone.trim() && email.trim() && totalKobo != null));

  return (
    <Shell onClose={onClose} wide={step === "slot"}>
      {step === "who" && (
        <>
          <span className="section-label">BOOK A FACILITY · STEP 1 OF {stepsTotal}</span>
          <h2 id="booking-title">
            Who is <em>booking?</em>
          </h2>
          <p className="modal-intro">Members and resident guests are not charged for facility use.</p>

          <div className="who-options" role="radiogroup" aria-label="Who is booking" style={{ marginTop: 22 }}>
            {whoChoices.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={who === c.id}
                className={who === c.id ? "who-option option-active" : "who-option"}
                onClick={() => (setError(""), setWho(c.id))}
              >
                <span className="who-radio" aria-hidden="true" />
                <span>
                  <strong>{c.title}</strong>
                  <small>{c.hint}</small>
                </span>
              </button>
            ))}
          </div>

          {who === "member" && (
            <>
              <div className="booking-field">
                <label htmlFor="memberNumber">MEMBERSHIP NUMBER</label>
                <input id="memberNumber" className="text-input" placeholder="On your membership card" value={memberNumber} onChange={(e) => setMemberNumber(e.target.value)} />
              </div>
              <p className="booking-notice">
                <Info size={14} /> Members can also <Link href="/login?next=/%3Fbook%3D1">sign in</Link> to book without typing their number.
              </p>
            </>
          )}
          {who === "resident" && (
            <>
              <div className="booking-field field-row">
                <div>
                  <label htmlFor="room">ROOM NUMBER</label>
                  <input id="room" className="text-input" value={room} onChange={(e) => setRoom(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="lastName">LAST NAME</label>
                  <input id="lastName" className="text-input" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <p className="booking-notice">
                <Info size={14} /> No payment needed. Reception confirms your stay when you arrive, so bring your room key.
              </p>
            </>
          )}
          {who === "walkin" && (
            <p className="booking-notice">
              <Info size={14} /> Walk-ins pay online to confirm. You get your booking code by email.
            </p>
          )}
          {errorBox}

          <button className="button button-coral full-button" type="button" disabled={!whoReady || pending} onClick={continueFromWho}>
            {pending ? "Checking…" : "Continue"} <ArrowRight size={16} />
          </button>
          <Link className="modal-link" href="/membership">
            Not a member yet? Become a member
          </Link>
        </>
      )}

      {step === "slot" && (
        <>
          {signedIn ? (
            <p className="booking-notice ok" style={{ marginTop: 0, marginBottom: 14 }}>
              <Check size={14} /> Booking as {signedIn.name}, member {signedIn.memberNumber}.
            </p>
          ) : (
            back("who")
          )}
          <span className="section-label" style={{ display: "block" }}>
            BOOK A FACILITY · STEP {stepNo(2)} OF {stepsTotal}
          </span>
          <h2 id="booking-title">
            Find your <em>playing time.</em>
          </h2>

          <div className="slot-layout">
            <div className="slot-main">
              <div className="booking-field">
                <label>FACILITY</label>
                <div className="facility-options">
                  {setup.facilities.map((f) => (
                    <button key={f.id} type="button" aria-pressed={f.id === facility.id} className={f.id === facility.id ? "option-active" : ""} onClick={() => pickFacility(f.id)}>
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="booking-field">
                <label>DATE</label>
                <div className="date-row">
                  {days.map((d) => (
                    <button key={d.iso} type="button" aria-pressed={d.iso === activeDay} className={d.iso === activeDay ? "date-pill date-active" : "date-pill"} onClick={() => pickDay(d.iso)}>
                      <strong>{d.dow}</strong>
                      <span>{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="booking-field">
                <div className="slot-meta">
                  <label>AVAILABLE TIMES</label>
                  <span>
                    Open {facility.opens} to {facility.closes === "24:00" ? "midnight" : facility.closes} · {facility.sessionMinutes}-minute sessions
                  </span>
                </div>
                {slots === null || loadingSlots ? (
                  <p className="slot-legend">Loading times…</p>
                ) : slots.length === 0 ? (
                  <p className="slot-legend">No times on this day.</p>
                ) : (
                  <div className="slot-grid">
                    {slots.map((s) => (
                      <button
                        key={s.start}
                        type="button"
                        disabled={s.state !== "free"}
                        aria-pressed={start === s.start}
                        className={start === s.start ? "slot-active" : s.state === "held" ? "slot-held" : ""}
                        onClick={() => (setError(""), setStart(s.start))}
                      >
                        {s.label}
                        {s.state === "taken" && <small>Booked</small>}
                        {s.state === "held" && <small>Held</small>}
                        {s.state === "past" && <small>Passed</small>}
                      </button>
                    ))}
                  </div>
                )}
                {slots?.some((s) => s.state === "held") && <p className="slot-legend">Held times are waiting for payment and may free up.</p>}
              </div>
              {errorBox}
            </div>

            <aside className="slot-side">
              {facility.rentals.length > 0 && (
                <fieldset className="equipment-box">
                  <legend>ADD EQUIPMENT</legend>
                  {facility.rentals.map((r) => (
                    <label key={r.id} className="equipment-row">
                      <input
                        type="checkbox"
                        checked={rentalIds.includes(r.id)}
                        onChange={(e) => setRentalIds((cur) => (e.target.checked ? [...cur, r.id] : cur.filter((x) => x !== r.id)))}
                      />
                      <span>{r.name}, per hour</span>
                      <b>{money(r.rateKobo)}</b>
                    </label>
                  ))}
                </fieldset>
              )}

              <div className="booking-summary">
                <span>1 session{chosen.length ? `, with ${chosen.map((r) => r.name.toLowerCase()).join(" and ")}` : ""}</span>
                <strong>{slot ? `${facility.name} · ${when}` : "Pick a time"}</strong>
              </div>

              <button className="button button-coral full-button" type="button" disabled={!slot} onClick={() => (setError(""), setStep("details"))}>
                Continue <ArrowRight size={16} />
              </button>
              <p className="booking-note">
                <ShieldCheck size={14} /> {who === "walkin" ? "You pay online on the next step." : "No charge for facility use."}
                {who !== "walkin" && chosen.length > 0 ? " Equipment is paid at the desk." : ""}
              </p>
            </aside>
          </div>
        </>
      )}

      {step === "details" && slot && (
        <>
          {back("slot")}
          <span className="section-label" style={{ display: "block" }}>
            BOOK A FACILITY · STEP {stepNo(3)} OF {stepsTotal}
          </span>
          <h2 id="booking-title">
            {who === "walkin" ? (
              <>
                Review and <em>pay.</em>
              </>
            ) : (
              <>
                Confirm your <em>booking.</em>
              </>
            )}
          </h2>

          <div className="receipt">
            <small>{facility.name}</small>
            <strong>{when}</strong>
            {who === "walkin" ? (
              <>
                <div className="receipt-line">
                  <span>{facility.name}, 1 session</span>
                  <span>{facility.walkInRateKobo == null ? "Not set" : money(facility.walkInRateKobo)}</span>
                </div>
                {chosen.map((r) => (
                  <div className="receipt-line" key={r.id}>
                    <span>{r.name}</span>
                    <span>{money(r.rateKobo * hours)}</span>
                  </div>
                ))}
                <div className="receipt-line receipt-total">
                  <span>Total</span>
                  <span>{totalKobo == null ? "Not set" : money(totalKobo)}</span>
                </div>
              </>
            ) : (
              <>
                {chosen.length > 0 && (
                  <div className="receipt-line">
                    <span>Equipment, paid at the desk</span>
                    <span>{chosen.map((r) => r.name).join(", ")}</span>
                  </div>
                )}
                <div className="receipt-line receipt-total">
                  <span>Facility use</span>
                  <span>No charge</span>
                </div>
              </>
            )}
          </div>

          {who === "walkin" && totalKobo == null && (
            <p className="booking-notice warn">
              <Clock3 size={14} /> The walk-in price for {facility.name} is not set yet. Please book at the Recreation desk.
            </p>
          )}

          {who === "member" ? (
            <p className="booking-notice ok">
              <Check size={14} /> Booking as {memberName || signedIn?.name}.
            </p>
          ) : (
            <>
              {who === "resident" && (
                <p className="booking-notice ok">
                  <Check size={14} /> Room {room}, {lastName}.
                </p>
              )}
              <div className="booking-field">
                <label htmlFor="fullName">FULL NAME{who === "resident" ? " (OPTIONAL)" : ""}</label>
                <input id="fullName" className="text-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="booking-field field-row">
                <div>
                  <label htmlFor="phone">PHONE</label>
                  <input id="phone" type="tel" className="text-input" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="email">EMAIL{who === "resident" ? " (OPTIONAL)" : ""}</label>
                  <input id="email" type="email" className="text-input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <label className="terms-row">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>
              I accept the{" "}
              <Link href="/terms" target="_blank" rel="noopener">
                terms and conditions
              </Link>
              .{who === "walkin" ? " A paid booking that is not used is not refunded." : ""}
            </span>
          </label>
          {errorBox}

          <button className="button button-coral full-button" type="button" disabled={!detailsReady || pending} onClick={book}>
            {pending ? (
              "Booking…"
            ) : who === "walkin" ? (
              <>
                <Lock size={15} /> Pay {totalKobo == null ? "" : money(totalKobo)} and book
              </>
            ) : (
              <>
                Confirm booking <ArrowRight size={16} />
              </>
            )}
          </button>
          {who === "walkin" && <p className="booking-note">Online payment is in test mode: no real money is taken yet.</p>}
        </>
      )}

      {step === "done" && result && (
        <div className="success-state">
          <span className="success-mark">
            <Check size={28} />
          </span>
          <span className="section-label">{result.free ? "NO PAYMENT NEEDED" : "BOOKED AND PAID"}</span>
          <h2 id="booking-title">{result.free ? "You are booked." : "Booking confirmed."}</h2>
          <p>
            {result.guestCheck
              ? "Reception confirms your stay when you arrive. Please bring your room key."
              : result.free
                ? "Your membership was checked. No payment is needed."
                : `We received ${money(result.paidKobo)}. Your booking code is below${email ? " and in your email" : ""}.`}
          </p>

          <div className="receipt" style={{ textAlign: "left" }}>
            <div className="receipt-line">
              <span>Booking code</span>
              <b className="booking-code">{result.code}</b>
            </div>
            <div className="receipt-line">
              <span>Facility</span>
              <b>{result.facility}</b>
            </div>
            <div className="receipt-line">
              <span>When</span>
              <b>{result.when}</b>
            </div>
            {result.rentals.length > 0 && (
              <div className="receipt-line">
                <span>Equipment</span>
                <b>{result.rentals.join(", ")}</b>
              </div>
            )}
          </div>
          <p className="success-small">Show this code at the Recreation desk. Please arrive 10 minutes early.</p>

          <div className="success-actions">
            {who === "member" && (
              <Link className="button button-dark" href={signedIn ? `/bookings/${result.code}` : "/login?next=/bookings"}>
                {signedIn ? "View booking" : "Sign in to see your bookings"} <ArrowRight size={16} />
              </Link>
            )}
            <button className="button button-outline" type="button" onClick={bookAnother}>
              Book another session
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className={wide ? "booking-modal booking-modal-wide" : "booking-modal"} role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close booking">
          <X size={20} />
        </button>
        {children}
      </section>
    </div>
  );
}
