import { NextResponse, type NextRequest } from "next/server";

/**
 * Quick check before a page renders: no session cookie means not signed in, so go
 * straight to the sign-in page (one page for members and staff). This is only a shortcut.
 * Every protected page and server action still checks the session properly (src/lib/auth/session.ts).
 */
const staffOpen = ["/staff/login", "/staff/setup"];
const memberOnly = ["/membership/me", "/membership/card", "/membership/profile"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (request.cookies.has("rec_session")) return NextResponse.next();

  if (pathname.startsWith("/staff") && !staffOpen.includes(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (memberOnly.includes(pathname)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Skip static files and images.
  matcher: ["/((?!_next/static|_next/image|api|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
