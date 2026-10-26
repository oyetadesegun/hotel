"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Check, Lock, Mail, X } from "lucide-react";
import { naira } from "@/src/lib/format";
import { Button, Divider, Field, Notice } from "./ui";
import { payForMembership } from "@/src/app/(customer)/membership/actions";

type Step = "details" | "redpay" | "processing" | "paid";
type Duration = "m1" | "m3" | "m6" | "annual";

/**
 * Pay for a membership straight from the rate cards.
 * We only ask for what the gateway needs (name, email, phone) plus a password, so the member
 * is signed in after paying and can come back any time. The full application (personal details,
 * health history, referee, declaration) is filled in afterwards on /membership/profile.
 *
 * The "redpay" step is a stand-in until the RedPay checkout is wired in: it records a
 * TEST payment through payForMembership, which creates the application (profile_pending),
 * signs the member in and emails them. With RedPay, the webhook does that part.
 */
export function MembershipPayModal({
  category,
  duration,
  durationLabel,
  amount,
  onClose,
}: {
  category: string;
  duration: Duration;
  durationLabel: string;
  amount: number;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ applicationRef: string } | null>(null);
  const [, startTransition] = useTransition();

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const passwordOk = password.length >= 10 && password === confirm;
  const ready = name.trim() && phone.trim() && emailOk && passwordOk && terms;
  const plan = `${category}, ${durationLabel.toLowerCase()}`;

  function pay() {
    setError("");
    setStep("processing");
    startTransition(async () => {
      const r = await payForMembership({ category, duration, fullName: name, email, phone, password, confirm, acceptTerms: terms });
      if ("error" in r) {
        setError(r.error);
        setStep("details");
      } else {
        setResult(r);
        setStep("paid");
      }
    });
  }

  // Close on Escape (not while payment is being confirmed) and stop the page scrolling behind.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && step !== "processing" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, step]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-110 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(e) => e.target === e.currentTarget && step !== "processing" && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-title"
        className="relative flex max-h-[92vh] w-full flex-col gap-4 overflow-y-auto [&>*]:shrink-0 rounded-t-2xl bg-white p-5 sm:max-w-[460px] sm:rounded-2xl sm:p-7"
      >
        {step !== "processing" && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full text-charcoal hover:bg-surface"
          >
            <X size={20} />
          </button>
        )}

        {step === "details" && (
          <>
            <div>
              <span className="text-[10px] font-extrabold tracking-[2px] text-charcoal-light">MEMBERSHIP · PAY</span>
              <h2 id="pay-title" className="mt-1.5 font-display text-[28px] font-normal leading-tight">
                {plan}
              </h2>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border-[1.5px] border-line px-3.5 py-3 text-sm">
              <div className="flex justify-between">
                <span>Membership fee</span>
                <span>{naira(amount)}</span>
              </div>
              <Divider />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{naira(amount)}</span>
              </div>
            </div>
            <Field label="Full name" id="payName" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="basis-full" />
            <div className="flex flex-wrap gap-3">
              <Field label="Email" id="payEmail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="basis-48" />
              <Field label="Phone" id="payPhone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="basis-36" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Field
                label="Create a password"
                id="payPassword"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="basis-40"
              />
              <Field
                label="Confirm password"
                id="payConfirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="basis-40"
              />
            </div>
            <p className="-mt-1 text-xs leading-relaxed text-charcoal">
              At least 10 characters, with letters and a number. You sign in with your email and this password to
              finish your profile and see your card. Been a member before? Use your existing password.
              {confirm && password !== confirm && <b className="text-bad-fg"> The passwords do not match yet.</b>}
            </p>
            <label className="flex items-start gap-2.5 text-[13px] leading-snug text-charcoal">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="size-5 shrink-0 accent-primary" />
              <span>
                I accept the{" "}
                <Link href="/terms" target="_blank" rel="noopener" className="font-semibold text-link underline">
                  terms and conditions
                </Link>
                . Paid in full, no instalments. Fees are non-refundable and a membership cannot be frozen or transferred.
              </span>
            </label>
            {error && <Notice tone="bad">{error}</Notice>}
            <Button type="button" full disabled={!ready} onClick={() => setStep("redpay")}>
              <Lock size={16} /> Pay {naira(amount)} with RedPay
            </Button>
          </>
        )}

        {step === "redpay" && (
          // Placeholder for the RedPay checkout popup.
          <>
            <div>
              <span className="text-[10px] font-extrabold tracking-[2px] text-charcoal-light">REDPAY CHECKOUT · PLACEHOLDER</span>
              <h2 id="pay-title" className="mt-1.5 text-xl font-bold">
                Pay {naira(amount)}
              </h2>
              <p className="text-[13px] text-charcoal">{email}</p>
            </div>
            <Notice tone="info">
              Test mode: the RedPay payment window opens here once it is connected. This button records a
              test payment (no real money) and creates your application.
            </Notice>
            <Button type="button" full onClick={pay}>
              Make test payment
            </Button>
            <Button type="button" variant="secondary" full onClick={() => setStep("details")}>
              Cancel
            </Button>
          </>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="size-10 animate-spin rounded-full border-4 border-neutral-bg border-t-primary" aria-hidden="true" />
            <h2 id="pay-title" className="text-xl font-bold">
              Confirming your payment
            </h2>
            <p role="status" className="text-sm text-charcoal">
              This usually takes a few seconds. Please keep this window open and do not pay again.
            </p>
          </div>
        )}

        {step === "paid" && (
          <div className="flex flex-col gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-ok-bg text-ok-fg">
              <Check size={28} />
            </span>
            <div>
              <span className="text-[10px] font-extrabold tracking-[2px] text-charcoal-light">PAYMENT RECEIVED</span>
              <h2 id="pay-title" className="mt-1.5 font-display text-[28px] font-normal leading-tight">
                One more step: <em className="text-primary">your profile.</em>
              </h2>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-surface px-3.5 py-3 text-[13px] leading-relaxed">
              <Mail size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                You are signed in. Your membership is <b>pending</b> until you complete your profile. We have also
                emailed <b>{email}</b> so you can come back to it later.
              </span>
            </div>
            <div className="text-xs text-charcoal">
              Application reference <b className="text-black">{result?.applicationRef}</b>
            </div>
            <Button href="/membership/profile" full>
              Complete my profile now
            </Button>
            <Button type="button" variant="secondary" full onClick={onClose}>
              I will do it later
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
