"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, Clock3, MapPin, Menu, ShieldCheck, Users, X, Zap } from "lucide-react";
import { BookingModal } from "@/src/components/BookingModal";
import { UserMenu, useCurrentUser } from "@/src/components/UserMenu";
import type { PublicSetup } from "@/src/lib/booking-engine";
import "@/src/app/landing.css";

/** Landing-page pictures for the original facilities, keyed by facility slug. New facilities get a plain card. */
const showcase: Record<string, { detail: string; image: string; tag: string; color: string }> = {
  padel: { detail: "Indoor & outdoor", image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=85", tag: "Most popular", color: "coral" },
  tennis: { detail: "Floodlit courts", image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=85", tag: "Open today", color: "green" },
  squash: { detail: "Climate controlled", image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=85", tag: "Quiet hours", color: "blue" },
  badminton: { detail: "Indoor hall", image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=85", tag: "Family friendly", color: "green" },
};

function Brand() {
  return (
    <>
      <Image
        src="/Transcorp_Hotels_Logo.png"
        alt="Transcorp Hotels"
        width={214}
        height={60}
        style={{ height: "auto" }}
        priority
      />
      <span className="brand-divider" aria-hidden="true" />
      <span className="brand-section">RECREATION</span>
    </>
  );
}

const sessionText = (m: number) => (m < 60 ? `${m}-minute` : m === 60 ? "1-hour" : `${m / 60}-hour`);

export function LandingPage({ setup }: { setup: PublicSetup }) {
  const facilities = setup.facilities;
  const me = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? "");

  const openBooking = (id = facilityId) => {
    setFacilityId(id);
    setMenuOpen(false);
    setShowBooking(true);
  };
  const closeBooking = useCallback(() => {
    setShowBooking(false);
    // Drop ?book=1 so a refresh does not reopen the popup.
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // Other pages link to /?book=1 (optionally &facility=tennis) to open the booking popup.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("book") !== "1") return;
    const id = params.get("facility");
    const match = facilities.find((f) => f.id === id || f.slug === id);
    if (match) setFacilityId(match.id);
    setShowBooking(true);
  }, [facilities]);

  return (
    <main className="site-shell">
      <header className="topbar fixed z-100 w-full">
        <a className="brand" href="#top" aria-label="Transcorp Hotels Recreation home">
          <Brand />
        </a>
        <nav className={menuOpen ? "nav-links nav-open" : "nav-links"} aria-label="Main navigation">
          <a href="#facilities" onClick={() => setMenuOpen(false)}>Facilities</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#membership" onClick={() => setMenuOpen(false)}>Membership</a>
          <Link href="/bookings" onClick={() => setMenuOpen(false)}>My bookings</Link>
        </nav>
        <div className="header-actions">
          <UserMenu signInClassName="text-button" />
          <button className="button button-dark header-book" type="button" onClick={() => openBooking()}>
            Book a facility <ArrowRight size={15} />
          </button>
          <button className="menu-button" type="button" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> TRANSCORP HOTELS RECREATION <span className="eyebrow-line" /></div>
          <h1>Recreation<br /><em>redefined.</em></h1>
          <p className="hero-subtitle">Make time for movement, connection, and play. Discover recreation facilities designed for better days at Transcorp Hotels.</p>
          <div className="hero-actions">
            <button className="button button-coral" type="button" onClick={() => openBooking()}>Find a facility <ArrowRight size={16} /></button>
            <a className="play-link" href="#how-it-works"><span className="play-icon">▶</span> See how it works</a>
          </div>
          <div className="hero-proof"><div className="avatar-stack"><span>AO</span><span>MK</span><span>+</span></div><span><strong>2,400+</strong> sessions booked this month</span></div>
        </div>
      </section>

      <section className="trust-row">
        <span>BUILT FOR BETTER DAYS</span><div />
        <strong><ShieldCheck size={17} /> Secure payments</strong>
        <strong><Zap size={17} /> Instant confirmation</strong>
        <strong><Clock3 size={17} /> 07:00 – 00:00 daily</strong>
      </section>

      <section className="section facilities-section" id="facilities">
        <div className="section-heading">
          <div><span className="section-label">FIND YOUR FLOW</span><h2>Something for <em>every mood.</em></h2></div>
          <button className="link-button" type="button" onClick={() => openBooking()}>Book a facility <ArrowRight size={16} /></button>
        </div>
        <div className="facility-grid">
          {facilities.map((f) => {
            const s = showcase[f.slug];
            return (
              <button className="facility-card" key={f.id} type="button" onClick={() => openBooking(f.id)}>
                <div className="facility-image" style={{ backgroundImage: s ? `url(${s.image})` : undefined, backgroundColor: "#e4e4e4" }}>
                  {s && <span className={`facility-tag ${s.color}`}>{s.tag}</span>}
                  <span className="facility-arrow"><ArrowRight size={17} /></span>
                </div>
                <div className="facility-info">
                  <div>
                    <h3>{f.name}</h3>
                    <p><MapPin size={14} /> {s?.detail ?? "Transcorp Hilton Abuja"} · {sessionText(f.sessionMinutes)} sessions</p>
                  </div>
                  <span className="facility-book">Book <ArrowRight size={14} /></span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="split-section" id="how-it-works">
        <div className="split-art">
          <div className="floating-card">
            <span className="floating-icon"><CalendarDays size={19} /></span>
            <div><strong>Your court is waiting.</strong><span>Booking confirmed · BK-7Q4M-2931</span></div>
            <Check size={20} className="check-icon" />
          </div>
        </div>
        <div className="split-copy">
          <span className="section-label">SIMPLE BY DESIGN</span>
          <h2>From “let’s play”<br />to <em>let’s go.</em></h2>
          <p>We’ve made booking feel less like admin and more like the start of something good.</p>
          <div className="steps">
            <div><span>01</span><div><strong>Tell us who’s playing</strong><p>Members and resident guests are checked automatically and book free.</p></div></div>
            <div><span>02</span><div><strong>Pick your place and time</strong><p>See live availability and secure your spot in one click.</p></div></div>
            <div><span>03</span><div><strong>Show up and play</strong><p>Get your booking code by email and show it at the desk.</p></div></div>
          </div>
        </div>
      </section>

      <section className="membership-section" id="membership">
        <div className="membership-copy">
          <span className="section-label">MORE THAN A BOOKING</span>
          <h2>Make recreation<br />part of <em>your routine.</em></h2>
          <p>Join a community that makes time for movement, connection, and a little healthy competition.</p>
          <Link className="button button-light" href="/membership">Explore membership <ArrowRight size={16} /></Link>
        </div>
        <div className="membership-stat">
          <Users size={25} />
          <strong>One place.<br /><em>Every kind of play.</em></strong>
          <span>Memberships · Guests · Walk-ins</span>
        </div>
      </section>

      <footer className="footer" id="support">
        <div className="brand"><Brand /></div>
        <span>© 2026 Transcorp Hotels Plc</span>
        <div className="footer-links">
          <Link href="/messages">Help centre</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/terms">Privacy</Link>
        </div>
      </footer>

      {showBooking && (
        <BookingModal setup={setup} me={me} facilityId={facilityId} onFacilityChange={setFacilityId} onClose={closeBooking} />
      )}
    </main>
  );
}
