"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "./ui";
import { staffHome, staffNav } from "@/src/lib/data";
import { can } from "@/src/lib/auth/roles";
import type { StaffRole } from "@/src/generated/prisma/client";
import { signOut } from "@/src/app/login/actions";

type User = { name: string; role: StaffRole; roleLabel: string };

function Account({ user }: { user: User }) {
  return (
    <div className="border-t border-charcoal-light px-3 pt-3 text-[13px]">
      <b>{user.name}</b>
      <div className="text-xs text-neutral-bg">{user.roleLabel}</div>
      <div className="mt-2 flex gap-3 text-xs font-semibold">
        <Link href="/staff/password" className="underline">
          Change password
        </Link>
        <form action={signOut}>
          <button type="submit" className="underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string, also: string[] = []) =>
    [href, ...also].some((h) => (h === "/staff" ? pathname === h : pathname === h || pathname.startsWith(h + "/")));
}

const groupIcons: Record<string, LucideIcon> = {
  Bookings: CalendarDays,
  Payments: Wallet,
  Members: Users,
  "Facilities and pricing": Building2,
  System: Settings,
  Oversight: ShieldCheck,
};

function Links({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  const isActive = useIsActive();
  const groups = staffNav.filter((g) => !g.perm || can(role, g.perm));
  const activeGroup = groups.find((g) => g.items.some((i) => isActive(i.href, i.also)))?.group ?? null;

  // One group open at a time. Whenever the page changes, open the group that holds it.
  const [open, setOpen] = useState<string | null>(activeGroup);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(activeGroup);
  }

  const homeActive = isActive(staffHome.href);

  return (
    <div className="flex flex-col gap-1">
      <Link
        href={staffHome.href}
        aria-current={homeActive ? "page" : undefined}
        className={cn(
          "flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-sm",
          homeActive ? "bg-primary font-bold text-black" : "font-semibold text-surface hover:bg-white/10",
        )}
      >
        <LayoutDashboard className="size-4 shrink-0" aria-hidden="true" />
        {staffHome.label}
      </Link>

      {groups.map((g) => {
        const Icon = groupIcons[g.group] ?? Settings;
        const isOpen = open === g.group;
        const holdsActive = activeGroup === g.group;
        const panelId = `staff-nav-${g.group.replace(/\W+/g, "-").toLowerCase()}`;
        return (
          <div key={g.group}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : g.group)}
              className={cn(
                "flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-sm hover:bg-white/10",
                holdsActive ? "font-bold text-white" : "font-semibold text-surface",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{g.group}</span>
              {holdsActive && !isOpen && <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />}
              <ChevronDown
                className={cn("size-4 shrink-0 text-neutral-bg transition-transform", isOpen && "rotate-180")}
                aria-hidden="true"
              />
            </button>
            <div
              id={panelId}
              inert={!isOpen}
              className={cn(
                "grid transition-[grid-template-rows] duration-200",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-charcoal-light pl-2.5">
                  {g.items.map((i) => {
                    const active = isActive(i.href, i.also);
                    return (
                      <Link
                        key={i.href}
                        href={i.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-9 items-center rounded-lg px-3 text-[13px]",
                          active ? "bg-primary font-bold text-black" : "font-medium text-surface hover:bg-white/10",
                        )}
                      >
                        {i.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StaffSidebar({ user }: { user: User }) {
  return (
    <nav
      aria-label="Staff"
      className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-0.5 overflow-y-auto bg-charcoal px-3.5 py-5 text-white lg:flex"
    >
      <div className="flex items-center gap-2.5 px-3 pb-3.5">
        <div className="size-7 rounded-lg bg-primary" aria-hidden="true" />
        <div>
          <div className="text-sm font-bold">Recreation</div>
          <div className="text-[11px] text-neutral-bg">Staff portal</div>
        </div>
      </div>
      <Links role={user.role} />
      <div className="flex-1" />
      <Account user={user} />
    </nav>
  );
}

/** Small-screen menu. The sidebar takes over from the lg breakpoint. */
export function StaffMobileBar({ user }: { user: User }) {
  return (
    <details className="group bg-charcoal text-white lg:hidden">
      <summary className="flex h-14 cursor-pointer list-none items-center gap-2.5 px-4">
        <div className="size-6 rounded-md bg-primary" aria-hidden="true" />
        <b className="flex-1 text-sm">Recreation staff portal</b>
        <span className="text-sm font-semibold">Menu</span>
      </summary>
      <div className="flex max-h-[70dvh] flex-col gap-0.5 overflow-y-auto px-3 pb-4">
        <Links role={user.role} />
        <div className="pt-3">
          <Account user={user} />
        </div>
      </div>
    </details>
  );
}
