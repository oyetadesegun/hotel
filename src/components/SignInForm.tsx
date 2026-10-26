"use client";

import { useActionState } from "react";
import { signIn } from "@/src/app/login/actions";
import { Button, Field, Notice } from "./ui";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="flex flex-col gap-3.5 [&>*]:flex-none!">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" id="email" type="email" autoComplete="username" required />
      <Field label="Password" id="password" type="password" autoComplete="current-password" required />
      {state?.error && <Notice tone="bad">{state.error}</Notice>}
      <Button type="submit" full size="md" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
