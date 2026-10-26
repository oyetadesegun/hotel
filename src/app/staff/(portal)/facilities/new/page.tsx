import type { Metadata } from "next";
import { requireStaffCan } from "@/src/lib/auth/session";
import { Card } from "@/src/components/ui";
import { PageTitle } from "@/src/components/staff";
import { FacilityForm } from "@/src/components/FacilityForms";

export const metadata: Metadata = { title: "Add a facility" };

export default async function NewFacilityPage() {
  await requireStaffCan("changeSetup");
  return (
    <>
      <PageTitle title="Add a facility" sub="A court, room or space customers can book. You can add rental items once it is saved." />
      <Card className="max-w-3xl">
        <FacilityForm />
      </Card>
    </>
  );
}
