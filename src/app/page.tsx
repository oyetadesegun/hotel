import { LandingPage } from "@/src/components/LandingPage";
import { getPublicSetup } from "@/src/lib/booking-engine";

/** The landing page. Facilities come from the database (cached until an admin changes the setup). */
export default async function HomePage() {
  return <LandingPage setup={await getPublicSetup()} />;
}
