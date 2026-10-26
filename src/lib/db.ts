import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/src/generated/prisma/client";

/**
 * The one Prisma client for the whole app. Server code only: importing this
 * from a Client Component fails the build, which keeps DATABASE_URL off the browser.
 *
 * It connects through Supabase's transaction pooler (DATABASE_URL, port 6543),
 * so many serverless instances can share a small number of Postgres connections.
 */
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local (see .env.example).");
  }

  return new PrismaClient({
    // Times are sent to Postgres without a time zone, so the connection must run in UTC.
    // Otherwise a server set to Lagos time stores every timestamp an hour early.
    adapter: new PrismaPg({ connectionString, options: "-c TimeZone=UTC" }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Reuse one client across hot reloads in development instead of opening a new pool each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
