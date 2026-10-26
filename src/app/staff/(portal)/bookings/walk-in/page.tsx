import { redirect } from "next/navigation";

/** Walk-in booking is part of desk booking. */
export default function WalkInPage() {
  redirect("/staff/bookings/new?who=walkin");
}
