-- One patient may not hold two live appointments with the same doctor on the
-- same calendar day. Before this, nothing stopped it: the booking route checked
-- neither in the application nor in the database, so a double-click on "Confirm"
-- produced two rows with two token numbers and two queue entries.
--
-- Expressed as a *partial* unique index, because uniqueness only applies to
-- appointments that are still live. A cancelled or completed visit must not
-- block re-booking, and a soft-deleted row must not block anything at all.
-- Prisma's `@@unique` cannot express a WHERE clause, so this is raw SQL and
-- schema.prisma carries a comment on the Appointment model pointing here.
--
-- No advisory lock is needed for this constraint, unlike token allocation.
-- Token allocation is a read-modify-write (read MAX, add one, insert), so
-- concurrent callers must be serialised to read each other's writes. A
-- duplicate booking is a plain insert of values the caller already has in hand:
-- there is nothing to read first, so the unique index alone decides the race
-- and the loser gets a deterministic rejection.
--
-- Sequenced the same way as the token-number migration: make the table
-- compliant before adding the constraint, rather than letting CREATE INDEX fail
-- with a bare "duplicate key value" and leave the migration half-applied.

-- 1. Refuse to proceed with a readable message if the table already violates
--    the rule. Deciding *which* of a pre-existing pair to cancel is a clinical
--    call, not something a migration should guess at, so this reports and stops.
DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(
           format('patient %s / doctor %s / %s (%s rows)',
                  "patientId", "doctorId", "scheduledDate", cnt),
           E'\n  '
         )
    INTO offending
  FROM (
    SELECT "patientId", "doctorId", "scheduledDate", COUNT(*) AS cnt
    FROM "Appointment"
    WHERE "deletedAt" IS NULL
      AND "status" IN ('BOOKED', 'CHECKED_IN', 'IN_CONSULTATION')
    GROUP BY "patientId", "doctorId", "scheduledDate"
    HAVING COUNT(*) > 1
  ) dupes;

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot add Appointment_patient_doctor_day_active_key: existing duplicate active bookings.%  %',
      E'\n  ', offending;
  END IF;
END $$;

-- 2. The guarantee. Scoped to live appointments only, so cancelling and
--    re-booking with the same doctor on the same day still works.
CREATE UNIQUE INDEX "Appointment_patient_doctor_day_active_key"
  ON "Appointment"("patientId", "doctorId", "scheduledDate")
  WHERE "deletedAt" IS NULL
    AND "status" IN ('BOOKED', 'CHECKED_IN', 'IN_CONSULTATION');
