"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { Button, Notice, cn } from "./ui";

type State = { error?: string; ok?: string; tempPassword?: string } | undefined;

/**
 * A form that runs a server action and shows its result: an error, a success line,
 * and (for staff accounts) a one-time temporary password.
 * What was typed stays in the form after an error, and is cleared after a success.
 */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = "Saving…",
  children,
  className,
  variant = "primary",
  full = true,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  submitLabel: string;
  pendingLabel?: string;
  children?: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "danger";
  full?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        // Submitting by hand stops React from clearing the form, so a mistake does not wipe what was typed.
        e.preventDefault();
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(fd));
      }}
      className={cn("flex flex-col gap-3.5 [&>*]:flex-none!", className)}>
      {children}
      {state?.error && <Notice tone="bad">{state.error}</Notice>}
      {state?.ok && (
        <Notice tone="ok">
          {state.ok}
          {state.tempPassword && (
            <>
              <br />
              Temporary password: <b className="select-all whitespace-nowrap font-mono text-base">{state.tempPassword}</b>
              <br />
              <span className="text-xs">Shown once. They must change it when they first sign in.</span>
            </>
          )}
        </Notice>
      )}
      <Button type="submit" disabled={pending} full={full} variant={variant} size="md">
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
