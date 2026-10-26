import { redirect } from "next/navigation";

export const instant = false;

/** Cancelling online is part of the booking module, which is not built yet. */
export default async function CancelPage({ params }: PageProps<"/bookings/[code]/cancel">) {
  const { code } = await params;
  redirect(`/bookings/${code}`);
}
