import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Passport photos are private, so they live outside /public in ./storage
 * and are only served through /api/membership-photo/[id] after a permission check.
 * Swap this for object storage (Supabase Storage, S3, Vercel Blob) before deploying:
 * a server's local disk does not survive redeploys.
 */
const ROOT = path.join(process.cwd(), "storage", "photos");
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export function photoProblem(file: File | null): string | null {
  if (!file || file.size === 0) return "Please add a passport photo.";
  if (!TYPES[file.type]) return "The photo must be a JPG, PNG or WebP image.";
  if (file.size > MAX_PHOTO_BYTES) return "The photo must be smaller than 4 MB.";
  return null;
}

/** Saves the photo and returns its stored name, e.g. "<membership id>.jpg". */
export async function savePhoto(membershipId: string, file: File): Promise<string> {
  await mkdir(ROOT, { recursive: true });
  const name = `${membershipId}.${TYPES[file.type]}`;
  await writeFile(path.join(ROOT, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function readPhoto(name: string): Promise<{ data: Buffer; type: string } | null> {
  if (!/^[0-9a-f-]+\.(jpg|png|webp)$/.test(name)) return null;
  try {
    const data = await readFile(path.join(ROOT, name));
    const ext = name.split(".").pop()!;
    const type = Object.entries(TYPES).find(([, e]) => e === ext)![0];
    return { data, type };
  } catch {
    return null;
  }
}
