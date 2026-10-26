"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { currentUser, type CurrentUser } from "@/src/app/session-actions";
import { signOut } from "@/src/app/login/actions";
import { cn } from "./ui";

// Headers and the booking popup mount together: they share one request instead of asking twice.
// It is only reused for a moment, so signing in or out is picked up on the next page.
let pending: { at: number; user: Promise<CurrentUser | null> } | null = null;
function loadUser() {
  if (!pending || Date.now() - pending.at > 2000) pending = { at: Date.now(), user: currentUser().catch(() => null) };
  return pending.user;
}

/** The signed-in person, or null. `undefined` while it is still loading. */
export function useCurrentUser(): CurrentUser | null | undefined {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    loadUser().then((u) => live && setUser(u));
    return () => {
      live = false;
    };
  }, []);
  return user;
}

export function Avatar({ user, size = 36 }: { user: CurrentUser; size?: number }) {
  return user.photoUrl ? (
    // A private photo served by our own route, so next/image is not needed.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.photoUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-[#f58220] font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {user.initials}
    </span>
  );
}

/**
 * Sign in link, or the signed-in person's avatar with a small menu
 * (their page, My bookings, Sign out).
 */
export function UserMenu({ signInClassName }: { signInClassName?: string }) {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (user === undefined) return <span className="inline-block size-9" aria-hidden="true" />;
  if (user === null) {
    return (
      <Link href="/login" className={signInClassName ?? "text-[13px] font-bold text-[#1c2924] hover:text-[#f58220]"}>
        Sign in
      </Link>
    );
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 hover:bg-black/5"
      >
        <Avatar user={user} />
        <ChevronDown size={14} className={cn("text-[#58635c] transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-120 w-60 overflow-hidden rounded-xl border border-[#eeeeee] bg-white text-left shadow-lg">
          <div className="flex items-center gap-3 border-b border-[#eeeeee] px-4 py-3">
            <Avatar user={user} size={40} />
            <div className="min-w-0">
              <b className="block truncate text-sm text-[#1c2924]">{user.name}</b>
              <span className="text-xs text-[#7b867e]">{user.kind === "staff" ? "Staff" : user.memberNumber ? `Member ${user.memberNumber}` : "Member"}</span>
            </div>
          </div>
          <Link role="menuitem" href={user.home.href} className="block px-4 py-2.5 text-sm text-[#1c2924] hover:bg-[#f7f7f7]">
            {user.home.label}
          </Link>
          {user.kind === "member" && (
            <Link role="menuitem" href="/bookings" className="block px-4 py-2.5 text-sm text-[#1c2924] hover:bg-[#f7f7f7]">
              My bookings
            </Link>
          )}
          <form action={signOut} className="border-t border-[#eeeeee]">
            <button role="menuitem" type="submit" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-[#9b2c1c] hover:bg-[#f7f7f7]">
              <LogOut size={15} aria-hidden="true" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
