import "server-only";

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** Passwords are stored as "scrypt$<salt>$<hash>" (base64). Never in plain text. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** The rule for every password in the system. Returns a message, or null when it is fine. */
export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use letters and at least one number.";
  return null;
}

/** A readable temporary password for new staff, e.g. "Kite-Mango-4821". */
export function temporaryPassword(): string {
  const words = ["Kite", "Mango", "River", "Court", "Lime", "Falcon", "Cedar", "Pebble", "Racket", "Summit", "Harbor", "Maple"];
  const pick = () => words[randomBytes(1)[0] % words.length];
  const digits = (randomBytes(2).readUInt16BE(0) % 9000) + 1000;
  return `${pick()}-${pick()}-${digits}`;
}
