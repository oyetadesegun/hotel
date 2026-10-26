import { loadEnvConfig } from "@next/env";
import { defineConfig, env } from "prisma/config";

// Load .env.local / .env exactly the way Next.js does, so the CLI and the app
// read the same values.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // The CLI (migrate, studio, db pull) uses the session pooler, not the
    // transaction pooler, because migrations need a long-lived session.
    url: env("DIRECT_URL"),
  },
});
