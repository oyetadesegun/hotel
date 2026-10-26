import { ActionForm } from "./ActionForm";
import { Field, inputClass } from "./ui";
import { saveBookingRules, saveMembershipRates } from "@/src/app/staff/setup-actions";
import { rateCategories, ruleFields } from "@/src/lib/facilities";
import type { RateRow } from "@/src/lib/membership";

export function BookingRulesForm({ values }: { values: Record<string, number | undefined> }) {
  const fee = values.application_form_fee_kobo;
  return (
    <ActionForm action={saveBookingRules} submitLabel="Save rules">
      {ruleFields.map((r) => (
        <Field
          key={r.key}
          label={r.label}
          id={r.key}
          type="number"
          min={r.min}
          max={r.max}
          required
          defaultValue={values[r.key]}
          className="basis-full"
        />
      ))}
      <Field
        label="Printed application form fee (₦)"
        id="application_form_fee"
        inputMode="decimal"
        required
        defaultValue={fee == null ? "" : String(fee / 100)}
        className="basis-full"
      />
    </ActionForm>
  );
}

const cols = [
  ["annual", "Annual"],
  ["m6", "6 months"],
  ["m3", "3 months"],
  ["m1", "1 month"],
] as const;

/** A whole new rate card, prefilled with today's prices. */
export function MembershipRatesForm({ current, today }: { current: RateRow[]; today: string }) {
  const byCategory = new Map(current.map((r) => [r.category, r]));
  return (
    <ActionForm action={saveMembershipRates} submitLabel="Save new rates" full={false} className="items-start">
      <Field label="New rates start on" id="effectiveFrom" type="date" required min={today} defaultValue={today} className="max-w-60 flex-none" />
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-1.5 text-sm">
          <thead>
            <tr>
              <th className="text-left font-semibold">Category</th>
              {cols.map(([, label]) => (
                <th key={label} className="text-left font-semibold">
                  {label} (₦)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rateCategories.map((category) => (
              <tr key={category}>
                <th scope="row" className="pr-2 text-left font-bold">
                  {category}
                </th>
                {cols.map(([key, label]) => {
                  const v = byCategory.get(category)?.[key];
                  return (
                    <td key={key}>
                      <input
                        name={`${category}|${key}`}
                        aria-label={`${category}, ${label}`}
                        inputMode="decimal"
                        defaultValue={v == null ? "" : String(v)}
                        placeholder="Per company"
                        className={inputClass + " h-10 text-sm"}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-relaxed text-charcoal">
        Leave a box empty for “agreed per company”. Old rates are kept, so payments already made keep the price that was charged.
      </p>
    </ActionForm>
  );
}
