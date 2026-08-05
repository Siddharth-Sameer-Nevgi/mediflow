/**
 * Calendar-date helpers for per-day token allocation.
 *
 * Token numbers restart each calendar day *in the hospital's own time zone*, so
 * "which day is this appointment on?" must be answered in that zone — not in
 * UTC, and not in whatever zone the app server happens to run in.
 *
 * The date is deliberately represented as a `YYYY-MM-DD` **string** rather than
 * a Postgres `date` column. Two measured driver behaviours motivate that:
 *
 *   1. Reading a `date` column back through node-postgres yields a JS Date at
 *      *local* midnight, so the same stored date deserialises to a different
 *      instant depending on the server's TZ.
 *   2. Writing a JS Date to a `date` column resolves the cast using the
 *      *Postgres session* time zone. A Date at UTC midnight for 2026-08-11
 *      stores as `2026-08-10` when the session zone is west of UTC.
 *
 * Either one would make the uniqueness scope of a token number depend on an
 * ambient timezone setting. This value's only job is to be an exact equality
 * and uniqueness key, so a string removes that entire class of bug.
 * `scheduledAt` remains the source of truth for real time arithmetic.
 */

/** Fixed to the Gregorian calendar so a locale default cannot change the output. */
const DATE_PART_FORMAT_LOCALE = "en-US-u-ca-gregory";

/**
 * The calendar date of `instant`, as observed in `timeZone`, formatted
 * `YYYY-MM-DD`.
 *
 * Throws a `RangeError` if `timeZone` is not a valid IANA zone. That is
 * intentional: silently falling back to UTC would mis-scope token numbers for
 * every appointment at that hospital, which is far harder to notice than a
 * failed booking.
 */
export function calendarDateInTimeZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat(DATE_PART_FORMAT_LOCALE, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const part = (type: Intl.DateTimeFormatPartTypes): string => {
    const found = parts.find((p) => p.type === type);
    if (!found) {
      throw new Error(
        `Could not resolve "${type}" for time zone "${timeZone}"`
      );
    }
    return found.value;
  };

  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}
