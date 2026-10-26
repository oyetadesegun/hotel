import { ActionForm } from "./ActionForm";
import { CheckRow, Field, inputClass } from "./ui";
import { saveFacility, saveRentalItem } from "@/src/app/staff/setup-actions";
import { halfHours, nairaInput, sessionLengths, timeOf } from "@/src/lib/facilities";

type FacilityValues = {
  id: string;
  name: string;
  sessionMinutes: number;
  opensAt: Date;
  closesAt: Date;
  maxSessionsPerDay: number;
  bookAheadDays: number;
  walkInRateKobo: bigint | null;
  active: boolean;
};

function Select({ label, id, defaultValue, options }: { label: string; id: string; defaultValue: string; options: [string, string][] }) {
  return (
    <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      <select id={id} name={id} defaultValue={defaultValue} className={inputClass}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Add a facility (no `facility`) or change one. */
export function FacilityForm({ facility }: { facility?: FacilityValues }) {
  const f = facility;
  return (
    <ActionForm action={saveFacility} submitLabel={f ? "Save changes" : "Add facility"} pendingLabel="Saving…">
      {f && <input type="hidden" name="id" value={f.id} />}
      <Field label="Name" id="name" required defaultValue={f?.name} placeholder="e.g. Padel court 2" className="basis-full" />
      <div className="flex flex-wrap gap-3.5">
        <Select
          label="Session length"
          id="sessionMinutes"
          defaultValue={String(f?.sessionMinutes ?? 60)}
          options={sessionLengths.map((m) => [String(m), m < 60 ? `${m} minutes` : m === 60 ? "1 hour" : `${m / 60} hours`])}
        />
        <Select label="Opens" id="opensAt" defaultValue={f ? timeOf(f.opensAt) : "07:00"} options={halfHours.slice(0, -1).map((t) => [t, t])} />
        <Select label="Closes" id="closesAt" defaultValue={f ? timeOf(f.closesAt, true) : "24:00"} options={halfHours.slice(1).map((t) => [t, t])} />
      </div>
      <div className="flex flex-wrap gap-3.5">
        <Field
          label="Sessions per person per day"
          id="maxSessionsPerDay"
          type="number"
          min={1}
          max={48}
          required
          defaultValue={f?.maxSessionsPerDay ?? 2}
        />
        <Field
          label="Customers can book ahead (days)"
          id="bookAheadDays"
          type="number"
          min={0}
          max={365}
          required
          defaultValue={f?.bookAheadDays ?? 7}
        />
        <Field
          label="Walk-in rate per session (₦)"
          id="walkInRate"
          inputMode="decimal"
          defaultValue={nairaInput(f?.walkInRateKobo)}
          placeholder="Not set"
          hint="Leave empty until the price is confirmed. Members and resident guests are not charged."
        />
      </div>
      <CheckRow name="active" defaultChecked={f?.active ?? true}>
        Open for booking
      </CheckRow>
    </ActionForm>
  );
}

/** Change one rental item: name, hourly rate, on or off. */
export function RentalItemForm({ facilityId, item }: { facilityId: string; item: { id: string; name: string; ratePerHourKobo: bigint; active: boolean } }) {
  return (
    <ActionForm action={saveRentalItem} submitLabel="Save" variant="secondary" full={false} className="items-start">
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="facilityId" value={facilityId} />
      <div className="flex w-full flex-wrap items-end gap-3.5">
        <Field label="Item" id={`name-${item.id}`} name="name" required defaultValue={item.name} />
        <Field label="Rate per hour (₦)" id={`rate-${item.id}`} name="rate" inputMode="decimal" required defaultValue={nairaInput(item.ratePerHourKobo)} />
        <div className="flex h-12 items-center">
          <CheckRow name="active" defaultChecked={item.active}>
            Available
          </CheckRow>
        </div>
      </div>
    </ActionForm>
  );
}

export function AddRentalItemForm({ facilityId }: { facilityId: string }) {
  return (
    <ActionForm action={saveRentalItem} submitLabel="Add item" pendingLabel="Adding…" full={false} className="items-start">
      <input type="hidden" name="facilityId" value={facilityId} />
      <div className="flex w-full flex-wrap gap-3.5">
        <Field label="Item" id="new-item-name" name="name" required placeholder="e.g. Racket" />
        <Field label="Rate per hour (₦)" id="new-item-rate" name="rate" inputMode="decimal" required placeholder="e.g. 5000" />
      </div>
    </ActionForm>
  );
}
