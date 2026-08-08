/**
 * Reproduces the two measurements cited in the comments in
 * app/api/appointments/route.ts, so neither number has to be taken on trust:
 *
 *   1. Database round-trip time, which sets the duration of the booking
 *      transaction's critical section and therefore the transaction timeout.
 *   2. How many concurrent token allocations fail when they are *not*
 *      serialised by the advisory lock, versus when they are. This is the
 *      justification for taking the lock at all.
 *
 * Run against the same database the app uses:
 *
 *   npx ts-node --project tsconfig.server.json scripts/measure-booking-contention.ts
 *
 * Optional: CONTENTION_N=20 to change the number of concurrent allocations.
 *
 * The Appointment table is never touched. The probe creates a scratch table
 * with the same shape as the part of Appointment that matters — a unique index
 * over (doctor, day, token) — exercises the same read-MAX/insert pattern
 * against it, and drops it again. It measures the race, not the route: the
 * route additionally does AI calls and four more inserts, so real bookings hold
 * the critical section longer than this does.
 */
import "dotenv/config";
import { Pool, type PoolClient } from "pg";

const CONNECTION_STRING = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const CONCURRENCY = Number(process.env.CONTENTION_N ?? 10);

const SCRATCH = "_contention_probe";
const DOCTOR = "probe-doctor";
const DAY = "2000-01-01";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

async function measureRoundTrip(pool: Pool, samples = 20): Promise<number[]> {
  const timings: number[] = [];
  for (let i = 0; i < samples; i++) {
    const started = process.hrtime.bigint();
    await pool.query("SELECT 1");
    timings.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  return timings;
}

/**
 * One token allocation: the same read-modify-write the booking transaction
 * performs. `useLock` toggles the advisory lock that serialises it.
 */
async function allocate(client: PoolClient, useLock: boolean): Promise<void> {
  await client.query("BEGIN");
  try {
    if (useLock) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `${DOCTOR}:${DAY}`,
      ]);
    }

    const { rows } = await client.query(
      `SELECT COALESCE(MAX("tokenNumber"), 0)::int AS max_token
         FROM "${SCRATCH}" WHERE "doctorId" = $1 AND "scheduledDate" = $2`,
      [DOCTOR, DAY]
    );

    await client.query(
      `INSERT INTO "${SCRATCH}" ("doctorId", "scheduledDate", "tokenNumber")
       VALUES ($1, $2, $3)`,
      [DOCTOR, DAY, rows[0].max_token + 1]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function runRound(
  pool: Pool,
  useLock: boolean
): Promise<{ ok: number; conflicts: number; other: number; ms: number }> {
  await pool.query(`TRUNCATE "${SCRATCH}"`);

  // One dedicated connection per caller, so they genuinely run concurrently
  // rather than queueing on a shared client.
  const clients = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => pool.connect())
  );

  const started = process.hrtime.bigint();
  const results = await Promise.allSettled(
    clients.map((client) => allocate(client, useLock))
  );
  const ms = Number(process.hrtime.bigint() - started) / 1e6;

  for (const client of clients) client.release();

  let ok = 0;
  let conflicts = 0;
  let other = 0;
  for (const result of results) {
    if (result.status === "fulfilled") ok++;
    else if ((result.reason as { code?: string })?.code === "23505") conflicts++;
    else other++;
  }

  return { ok, conflicts, other, ms };
}

async function main(): Promise<void> {
  if (!CONNECTION_STRING) {
    throw new Error("DATABASE_URL (or DIRECT_URL) is not set.");
  }

  const pool = new Pool({
    connectionString: CONNECTION_STRING,
    max: CONCURRENCY + 2,
  });

  try {
    const timings = await measureRoundTrip(pool);
    const rtt = median(timings);

    console.log("Database round-trip (SELECT 1)");
    console.log(`  samples : ${timings.length}`);
    console.log(`  median  : ${rtt.toFixed(1)} ms`);
    console.log(`  min/max : ${Math.min(...timings).toFixed(1)} / ${Math.max(...timings).toFixed(1)} ms`);
    console.log(
      `  the booking transaction's critical section is 6 statements, so ~${(
        rtt * 6
      ).toFixed(0)} ms per booking at this RTT\n`
    );

    await pool.query(`
      CREATE UNLOGGED TABLE IF NOT EXISTS "${SCRATCH}" (
        "doctorId"      text    NOT NULL,
        "scheduledDate" text    NOT NULL,
        "tokenNumber"   integer NOT NULL
      )
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "${SCRATCH}_key"
        ON "${SCRATCH}"("doctorId", "scheduledDate", "tokenNumber")
    `);

    for (const useLock of [false, true]) {
      const { ok, conflicts, other, ms } = await runRound(pool, useLock);
      console.log(
        `${CONCURRENCY} concurrent token allocations, advisory lock ${
          useLock ? "ON " : "OFF"
        }`
      );
      console.log(`  committed        : ${ok}`);
      console.log(`  unique conflicts : ${conflicts}`);
      if (other > 0) console.log(`  other failures   : ${other}`);
      console.log(`  wall clock       : ${ms.toFixed(0)} ms\n`);
    }
  } finally {
    await pool.query(`DROP TABLE IF EXISTS "${SCRATCH}"`);
    await pool.end();
  }
}

void main();
