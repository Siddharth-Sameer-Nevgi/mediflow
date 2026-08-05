import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Migrate/Studio only. Prefer the unpooled endpoint: Prisma Migrate holds a
    // session-level advisory lock for the duration of a migration, which a
    // transaction-mode pooler (Neon's `-pooler` host) cannot keep across
    // statements. Application runtime is unaffected — lib/prisma.ts builds its
    // own pg Pool from DATABASE_URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
