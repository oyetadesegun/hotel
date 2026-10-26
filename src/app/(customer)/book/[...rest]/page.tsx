import { redirect } from "next/navigation";

/** Old addresses from the booking prototype. Booking happens in the popup on the landing page. */
export default function OldBookingPage() {
  redirect("/?book=1");
}
