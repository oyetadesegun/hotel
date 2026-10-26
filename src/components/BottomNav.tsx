"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellIcon, CalendarIcon, CardIcon, ListIcon, cn } from "./ui";

const items = [
  { href: "/?book=1", match: "/book", label: "Book", Icon: CalendarIcon },
  { href: "/bookings", match: "/bookings", label: "My bookings", Icon: ListIcon },
  { href: "/messages", match: "/messages", label: "Messages", Icon: BellIcon },
  { href: "/membership", match: "/membership", label: "Membership", Icon: CardIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-line bg-white px-3 pb-4 pt-2 md:hidden">
      {items.map(({ href, match, label, Icon }) => {
        const active = pathname === match || pathname.startsWith(match + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center gap-0.5 text-xs",
              active ? "font-bold text-black" : "font-semibold text-charcoal",
            )}
          >
            <Icon className={active ? "text-primary-dark" : "text-charcoal"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
