import { redirect } from "next/navigation";

/** Old demo address. The verify page now shows valid and invalid results itself. */
export default function VerifyInvalidPage() {
  redirect("/staff/verify");
}
