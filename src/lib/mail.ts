import "server-only";

import { audit } from "@/src/lib/audit";

/**
 * Sends an email. No email provider is connected yet (EMAIL_API_KEY is empty),
 * so for now the message is printed in the terminal running `npm run dev`,
 * and the audit trail records that it was sent (without the body, which can hold sign-in links).
 * Plug the provider in here and every email in the app starts going out.
 */
export async function sendEmail(msg: { to: string; subject: string; text: string }) {
  const provider = process.env.EMAIL_API_KEY ? "provider" : "terminal";

  if (provider === "terminal") {
    console.log(
      [
        "",
        "──────── EMAIL (not delivered: no email provider set) ────────",
        `To:      ${msg.to}`,
        `Subject: ${msg.subject}`,
        "",
        msg.text,
        "───────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  }
  // else: call the email provider's API here.

  await audit("system", "Email sent", msg.to, { subject: msg.subject, via: provider });
}

export function appUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}${path}`;
}
