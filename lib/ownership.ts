import { prisma } from "@/lib/prisma";

/**
 * Object-level authorisation for route handlers.
 *
 * A role check answers "may this kind of user do this kind of thing". It does
 * not answer "may *this* user touch *this* row", and every handler in this app
 * that skipped the second question could be driven with an id supplied by the
 * caller. This module is the one place that second question is answered.
 *
 * Two rules hold throughout:
 *
 *   1. The actor's own entity is resolved from `session.user.id`, never from
 *      anything the client sent — not a body field, not a path segment, not a
 *      JWT claim that can outlive a revocation.
 *   2. "No such row" and "not your row" return the same `null`, and callers must
 *      turn that into **404, never 403**. A 403 confirms the id exists, which
 *      makes the endpoint an oracle: an attacker enumerating cuids learns which
 *      ones are real and how many the hospital has, without ever being allowed
 *      to touch one.
 */

/** The authenticated caller, as far as any ownership rule is concerned. */
export interface Actor {
  /** `User.id` — the session subject, not a Patient/Doctor/Admin id. */
  id: string;
  role: string;
}

/**
 * The hospital an admin actually administers.
 *
 * Read from the Admin row rather than the JWT's `hospitalId` claim, so a
 * reassignment or a revocation takes effect on the next request instead of
 * whenever the token happens to refresh.
 */
export async function resolveActorHospitalId(
  userId: string
): Promise<string | null> {
  const admin = await prisma.admin.findUnique({
    where: { userId },
    select: { hospitalId: true },
  });
  return admin?.hospitalId ?? null;
}

/**
 * The `Doctor.id` behind a signed-in doctor's `User.id`.
 *
 * Handlers that used to accept a `doctorId` from the client call this instead.
 * Returns `null` when the account has no doctor profile, which callers report
 * as 404 like any other "not yours".
 */
export async function resolveActorDoctorId(
  userId: string
): Promise<string | null> {
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true },
  });
  return doctor?.id ?? null;
}

/**
 * Everything the appointment ownership rules need, in one round-trip.
 */
const OWNERSHIP_INCLUDE = {
  patient: { select: { userId: true } },
  doctor: { select: { userId: true } },
  department: { select: { hospitalId: true } },
} as const;

export type OwnedAppointment = NonNullable<
  Awaited<ReturnType<typeof findOwnedAppointment>>
>;

/**
 * Load an appointment only if the caller is entitled to act on it, else `null`.
 */
export async function findOwnedAppointment(id: string, actor: Actor) {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: OWNERSHIP_INCLUDE,
  });

  if (!appointment) return null;

  switch (actor.role) {
    /**
     * Prevents: a signed-in patient reading or cancelling a *stranger's*
     * appointment by guessing or enumerating its id. This is the rule the
     * socket server's `patient:join` already enforced before joining
     * `appointment:<id>` (server/socket-server.ts) — applying it here is what
     * stops the HTTP path being the softer way in.
     */
    case "PATIENT":
      return appointment.patient.userId === actor.id ? appointment : null;

    /**
     * Prevents: doctor A acting on doctor B's patient — marking them NO_SHOW or
     * COMPLETED, reading their details, reordering B's queue. A bare
     * `role === "DOCTOR"` check authorises *a* doctor, never *this* row's
     * doctor.
     */
    case "DOCTOR":
      return appointment.doctor.userId === actor.id ? appointment : null;

    /**
     * Prevents: an admin of hospital X acting on hospital Y's appointments.
     */
    case "ADMIN": {
      const hospitalId = await resolveActorHospitalId(actor.id);
      return hospitalId && hospitalId === appointment.department.hospitalId
        ? appointment
        : null;
    }

    default:
      return null;
  }
}

/**
 * Load a doctor only if the caller is entitled to see that doctor's queue,
 * else `null`.
 *
 * The same three branches as findOwnedAppointment, resolved through the same
 * helpers — a queue is scoped by doctor rather than by appointment, so it needs
 * its own lookup, but not its own notion of who the actor is.
 */
export async function findOwnedDoctor(doctorId: string, actor: Actor) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      id: true,
      userId: true,
      department: { select: { hospitalId: true } },
    },
  });

  if (!doctor) return null;

  switch (actor.role) {
    /**
     * Prevents: doctor A pulling doctor B's live queue, which carries every
     * waiting patient's name and email (getQueueByDoctor selects them).
     */
    case "DOCTOR":
      return doctor.userId === actor.id ? doctor : null;

    /**
     * Prevents: an admin of one hospital watching another hospital's floor.
     */
    case "ADMIN": {
      const hospitalId = await resolveActorHospitalId(actor.id);
      return hospitalId && hospitalId === doctor.department.hospitalId
        ? doctor
        : null;
    }

    /**
     * Patients are refused outright rather than given a redacted view. A queue
     * payload is a roster of who is sitting in a waiting room and what they are
     * being seen for, and no patient-facing screen asks for one: the patient
     * queue page reads /api/queue/position/<appointmentId>, which returns only
     * that patient's own standing. Adding a count-only branch here would be a
     * second shape of the same endpoint with no caller.
     */
    default:
      return null;
  }
}
