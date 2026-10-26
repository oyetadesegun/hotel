"use client";

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { submitProfile } from "@/src/app/(customer)/membership/actions";
import { declarations, type MembershipProfile } from "@/src/lib/profile";
import { Button, CheckRow, Field, Notice, OptionCard, cn, inputClass } from "./ui";

/**
 * The membership application (Hiltonia Recreation Club form), filled in online
 * after payment, by a signed-in member (or from an emailed link). Sections follow the paper form, see AGENTS-Form.md:
 * applicant details, hotel facility use, health history, referee, declaration.
 * The "Official use only" pages are staff fields and live on /staff/applications.
 *
 * Every step is its own <form> and stays mounted (just hidden), so typed answers
 * are kept when moving back and forth, and the browser only checks the visible step.
 * On the last step all five forms (and the photo) go to the server in one submission.
 *
 * With `saved`, the form opens with the member's earlier answers so they can update them
 * until staff approve the application.
 */

const steps = ["You", "Facilities", "Health", "Referee", "Declaration"] as const;

const hotelFacilities = ["Rooms", "Restaurants and bars", "Laundry shop", "Pastry shop", "Meeting rooms"];

const limitations = ["Heart", "Breathing", "Blood pressure", "Neck or shoulder", "Back", "Hips", "Knees, ankles or feet", "Arms"];

export type ProfilePrefill = { name: string; email: string; phone: string };

export function MembershipProfileForm({
  token = "",
  prefill,
  saved = null,
  hasPhoto = false,
  needsPassword = false,
}: {
  /** Only when opened from an emailed link. */
  token?: string;
  prefill: ProfilePrefill;
  /** Earlier answers, when updating a submitted profile. */
  saved?: MembershipProfile | null;
  hasPhoto?: boolean;
  /** Ask for a password only if the account has none yet. */
  needsPassword?: boolean;
}) {
  const p = saved;
  const [step, setStep] = useState(0);
  const [state, submit, pending] = useActionState(submitProfile, undefined);
  const [usesHotel, setUsesHotel] = useState<"yes" | "no" | null>(p?.usesHotel ?? null);
  const [otherFacility, setOtherFacility] = useState(p?.hotelFacilities.includes("Other") ?? false);
  const [otherLimit, setOtherLimit] = useState(p?.limitations.includes("Other") ?? false);
  const [smokes, setSmokes] = useState<"yes" | "no" | null>(p?.smokes ?? null);

  function next(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < steps.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // Put every step's answers (and the photo) into one submission.
      const all = new FormData();
      if (token) all.set("token", token);
      steps.forEach((_, i) => {
        const form = document.getElementById(`step-${i}`) as HTMLFormElement;
        new FormData(form).forEach((value, key) => all.append(key, value));
      });
      startTransition(() => submit(all));
    }
  }

  const last = step === steps.length - 1;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ol className="flex gap-1 text-[11px] font-semibold" aria-label="Profile steps">
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "flex-1 truncate rounded-full px-1 py-1.5 text-center",
              i === step ? "bg-charcoal text-white" : i < step ? "bg-ok-bg text-ok-fg" : "bg-neutral-bg text-charcoal",
            )}
          >
            {i + 1} {s}
          </li>
        ))}
      </ol>

      {/* 1. Applicant details */}
      <StepForm id="step-0" active={step === 0} onSubmit={next} title="Your details">
        <Field label="Full name" id="fullName" autoComplete="name" defaultValue={prefill.name} required className="basis-full" />
        <div className="flex flex-wrap gap-3">
          <Field
            label="Phone"
            id="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={prefill.phone}
            required
            className="basis-36"
          />
          <Field
            label="Email (your sign-in)"
            id="email"
            type="email"
            defaultValue={prefill.email}
            readOnly
            className="basis-48"
          />
        </div>
        <TextArea label="Office address" id="officeAddress" required defaultValue={p?.officeAddress} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="photo" className="text-[13px] font-semibold">
            {hasPhoto ? "Change passport photo (optional)" : "Passport photo"}
          </label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required={!hasPhoto}
            className={inputClass + " h-auto border-dashed p-2.5 text-sm"}
          />
          <span className="text-xs text-charcoal">
            JPG, PNG or WebP, under 4 MB. Used on your membership card.
            {hasPhoto && " Leave empty to keep your current photo."}
          </span>
        </div>
      </StepForm>

      {/* 2. Hotel facility use */}
      <StepForm id="step-1" active={step === 1} onSubmit={next} title="Hotel facilities">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[13px] font-semibold">Do you use any other hotel facilities?</legend>
          <div className="grid grid-cols-2 gap-2">
            <OptionCard name="usesHotel" value="yes" required checked={usesHotel === "yes"} onChange={() => setUsesHotel("yes")}>
              Yes
            </OptionCard>
            <OptionCard name="usesHotel" value="no" checked={usesHotel === "no"} onChange={() => setUsesHotel("no")}>
              No
            </OptionCard>
          </div>
        </fieldset>
        {usesHotel === "yes" && (
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-1.5 text-[13px] font-semibold">Tick all that apply</legend>
            {hotelFacilities.map((f) => (
              <CheckRow key={f} name="hotelFacilities" value={f} defaultChecked={p?.hotelFacilities.includes(f)}>
                {f}
              </CheckRow>
            ))}
            <CheckRow
              name="hotelFacilities"
              value="Other"
              checked={otherFacility}
              onChange={(e) => setOtherFacility(e.target.checked)}
            >
              Other
            </CheckRow>
            {otherFacility && (
              <Field
                label="Which other facilities?"
                id="hotelFacilitiesOther"
                required
                defaultValue={p?.hotelFacilitiesOther}
                className="basis-full"
              />
            )}
          </fieldset>
        )}
      </StepForm>

      {/* 3. Health history */}
      <StepForm id="step-2" active={step === 2} onSubmit={next} title="Health history">
        <Notice>Only the Recreation Manager sees your health answers. They help us keep you safe.</Notice>
        <div className="flex flex-wrap gap-3">
          <Field
            label="Date of last medical check-up"
            id="lastExamDate"
            type="date"
            defaultValue={p?.lastExamDate}
            className="basis-40"
          />
          <Field label="Where was it done?" id="lastExamPlace" defaultValue={p?.lastExamPlace} className="basis-48" />
        </div>
        <TextArea
          label="Past operations or hospital stays"
          id="operations"
          hint="Write “None” if there are none."
          required
          defaultValue={p?.operations}
        />
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1.5 text-[13px] font-semibold">
            Do you have any limits from illness, surgery or an accident? Tick all that apply.
          </legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {limitations.map((l) => (
              <CheckRow key={l} name="limitations" value={l} defaultChecked={p?.limitations.includes(l)}>
                {l}
              </CheckRow>
            ))}
            <CheckRow name="limitations" value="Other" checked={otherLimit} onChange={(e) => setOtherLimit(e.target.checked)}>
              Other
            </CheckRow>
          </div>
          {otherLimit && (
            <Field
              label="Describe the other limits"
              id="limitationsOther"
              required
              defaultValue={p?.limitationsOther}
              className="basis-full"
            />
          )}
        </fieldset>
        <TextArea
          label="Medicines you take now"
          id="medications"
          hint="Write “None” if there are none."
          required
          defaultValue={p?.medications}
        />
        <TextArea label="Allergies" id="allergies" hint="Write “None” if there are none." required defaultValue={p?.allergies} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[13px] font-semibold">Do you smoke?</legend>
          <div className="grid grid-cols-2 gap-2">
            <OptionCard name="smokes" value="yes" required checked={smokes === "yes"} onChange={() => setSmokes("yes")}>
              Yes
            </OptionCard>
            <OptionCard name="smokes" value="no" checked={smokes === "no"} onChange={() => setSmokes("no")}>
              No
            </OptionCard>
          </div>
          {smokes === "yes" && (
            <Field
              label="How many a day?"
              id="smokesPerDay"
              inputMode="numeric"
              required
              defaultValue={p?.smokesPerDay}
              className="basis-full"
            />
          )}
        </fieldset>
        <Field
          label="Alcohol: how often and how much?"
          id="alcohol"
          placeholder="For example, 2 drinks at weekends"
          required
          defaultValue={p?.alcohol}
          className="basis-full"
        />
        <TextArea
          label="Sports or exercise you do regularly"
          id="activities"
          hint="Say how often and for how long, for example “Tennis, twice a week, 1 hour”."
          defaultValue={p?.activities}
        />
        <h3 className="mt-2 text-[15px] font-bold">Your doctor</h3>
        <Field label="Doctor's phone" id="physicianPhone" type="tel" defaultValue={p?.physicianPhone} className="basis-full" />
        <TextArea label="Doctor's address" id="physicianAddress" defaultValue={p?.physicianAddress} />
        <h3 className="mt-2 text-[15px] font-bold">Emergency contact</h3>
        <div className="flex flex-wrap gap-3">
          <Field label="Full name" id="emergencyName" required defaultValue={p?.emergency.name} className="basis-48" />
          <Field
            label="Relationship to you"
            id="emergencyRelationship"
            required
            defaultValue={p?.emergency.relationship}
            className="basis-36"
          />
        </div>
        <Field label="Phone" id="emergencyPhone" type="tel" required defaultValue={p?.emergency.phone} className="basis-full" />
        <TextArea label="Address" id="emergencyAddress" defaultValue={p?.emergency.address} />
      </StepForm>

      {/* 4. Referee */}
      <StepForm id="step-3" active={step === 3} onSubmit={next} title="Your referee">
        <p className="text-[13px] leading-relaxed text-charcoal">
          Someone who can vouch for you. We will contact them to confirm.
        </p>
        <Field label="Referee's full name" id="refereeName" required defaultValue={p?.referee.name} className="basis-full" />
        <TextArea label="Referee's office address" id="refereeAddress" required defaultValue={p?.referee.address} />
        <div className="flex flex-wrap gap-3">
          <Field
            label="Referee's phone"
            id="refereePhone"
            type="tel"
            required
            defaultValue={p?.referee.phone}
            className="basis-36"
          />
          <Field
            label="Referee's email (optional)"
            id="refereeEmail"
            type="email"
            defaultValue={p?.referee.email}
            className="basis-48"
          />
        </div>
      </StepForm>

      {/* 5. Waiver and declaration */}
      <StepForm id="step-4" active={step === 4} onSubmit={next} title="Declaration">
        <p className="text-[13px] leading-relaxed text-charcoal">Please read and tick each statement.</p>
        <div className="flex flex-col gap-3">
          {declarations.map((d, i) => (
            <label key={d} className="flex items-start gap-2.5 text-sm leading-snug">
              <input
                type="checkbox"
                name={`declaration${i + 1}`}
                required
                defaultChecked={p != null}
                className="mt-0.5 size-5 shrink-0 accent-primary"
              />
              <span>{d}</span>
            </label>
          ))}
        </div>
        <Field
          label="Type your full name to sign"
          id="signature"
          autoComplete="name"
          required
          defaultValue={p?.signature}
          className="basis-full"
          hint="Your typed name counts as your signature, dated today."
        />
        {needsPassword && (
          <>
            <h3 className="mt-2 text-[15px] font-bold">Create your password</h3>
            <p className="-mt-2 text-[13px] text-charcoal">
              You sign in with your email, {prefill.email}, and this password to see your membership.
            </p>
            <Field
              label="Password"
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              hint="At least 10 characters, with letters and a number."
              className="basis-full"
            />
            <Field
              label="Confirm password"
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              className="basis-full"
            />
          </>
        )}
      </StepForm>

      {state?.error && <Notice tone="bad">{state.error}</Notice>}
      <div className="flex-1" />
      <div className="flex gap-2.5">
        {step > 0 && (
          <Button type="button" variant="secondary" onClick={() => setStep(step - 1)} className="px-4" aria-label="Previous step">
            <ArrowLeft size={18} />
          </Button>
        )}
        <Button type="submit" form={`step-${step}`} full className="flex-1" disabled={pending}>
          {last ? (pending ? "Saving…" : saved ? "Save changes" : "Submit my profile") : "Continue"}
        </Button>
      </div>
    </div>
  );
}

function StepForm({
  id,
  active,
  title,
  onSubmit,
  children,
}: {
  id: string;
  active: boolean;
  title: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <form id={id} hidden={!active} onSubmit={onSubmit} className="flex flex-col gap-3.5 [&[hidden]]:hidden">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </form>
  );
}

function TextArea({
  label,
  id,
  hint,
  required,
  defaultValue,
}: {
  label: string;
  id: string;
  hint?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        rows={2}
        required={required}
        defaultValue={defaultValue}
        className={inputClass + " h-auto py-2.5"}
      />
      {hint && <span className="text-xs text-charcoal">{hint}</span>}
    </div>
  );
}
