import { redirect } from "next/navigation";

/** Booking now happens in the popup on the landing page. Keep /book working for old links. */
export default function BookPage() {
  redirect("/?book=1");
}
