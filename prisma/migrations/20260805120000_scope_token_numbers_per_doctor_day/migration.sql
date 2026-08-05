-- Token numbers must be unique per doctor per calendar day. A uniqueness
-- constraint needs a concrete day key to be scoped against, so this adds a
-- normalised calendar-date column derived from `scheduledAt` in the owning
-- hospital's time zone.
--
-- Sequenced so it is safe against a table that already contains rows:
-- add nullable -> backfill -> enforce NOT NULL -> add the constraint.
-- Prisma's auto-generated diff adds the column NOT NULL in one statement, which
-- fails on any non-empty table.

-- 1. Add nullable so existing rows are not rejected.
ALTER TABLE "Appointment" ADD COLUMN "scheduledDate" VARCHAR(10);

-- 2. Backfill from `scheduledAt`, converted into the hospital's time zone.
--    `scheduledAt` is TIMESTAMP(3) (no zone) holding a UTC instant, so it must
--    first be *labelled* UTC and only then shifted. A single `AT TIME ZONE
--    h."timezone"` would interpret the stored value as already being local and
--    land a day off for evening appointments.
UPDATE "Appointment" a
SET "scheduledDate" = to_char(
      (a."scheduledAt" AT TIME ZONE 'UTC') AT TIME ZONE h."timezone",
      'YYYY-MM-DD'
    )
FROM "Department" d
JOIN "Hospital" h ON h."id" = d."hospitalId"
WHERE d."id" = a."departmentId";

-- 3. Fall back to UTC for any row whose department/hospital lookup found
--    nothing, rather than blocking the migration on it.
UPDATE "Appointment"
SET "scheduledDate" = to_char("scheduledAt", 'YYYY-MM-DD')
WHERE "scheduledDate" IS NULL;

-- 4. Every row now has a value.
ALTER TABLE "Appointment" ALTER COLUMN "scheduledDate" SET NOT NULL;

-- 5. The actual guarantee: no two appointments for one doctor on one day may
--    share a token number, regardless of application logic. Also serves as the
--    read index for the token allocator's MAX(tokenNumber) lookup.
CREATE UNIQUE INDEX "Appointment_doctorId_scheduledDate_tokenNumber_key"
  ON "Appointment"("doctorId", "scheduledDate", "tokenNumber");
