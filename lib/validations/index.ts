import { z } from "zod";

// Auth schemas
export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["PATIENT", "DOCTOR", "ADMIN"]),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Appointment schemas
export const bookAppointmentSchema = z.object({
  doctorId: z.string().cuid(),
  departmentId: z.string().cuid(),
  scheduledAt: z.string().datetime(),
  appointmentType: z
    .enum([
      "FIRST_CONSULTATION",
      "FOLLOW_UP",
      "PRESCRIPTION_REFILL",
      "DIAGNOSTIC_REVIEW",
      "EMERGENCY",
    ])
    .default("FIRST_CONSULTATION"),
  notes: z.string().max(500).optional(),
  isEmergency: z.boolean().default(false),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum([
    "BOOKED",
    "CHECKED_IN",
    "IN_CONSULTATION",
    "COMPLETED",
    "NO_SHOW",
    "CANCELLED",
  ]),
});

// Queue schemas
export const callNextSchema = z.object({
  doctorId: z.string().cuid(),
});

export const emergencyQueueSchema = z.object({
  appointmentId: z.string().cuid(),
  reason: z.string().min(5),
});

// AI schemas
export const triageSchema = z.object({
  symptoms: z
    .string()
    .min(10, "Please describe your symptoms in more detail")
    .max(500, "Description too long"),
});

export const predictWaitSchema = z.object({
  doctorId: z.string().cuid(),
  appointmentType: z
    .enum([
      "FIRST_CONSULTATION",
      "FOLLOW_UP",
      "PRESCRIPTION_REFILL",
      "DIAGNOSTIC_REVIEW",
      "EMERGENCY",
    ])
    .default("FIRST_CONSULTATION"),
});

// Hospital/Department schemas
export const createHospitalSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(5),
  city: z.string().min(2),
  timezone: z.string().default("Asia/Kolkata"),
});

export const createDepartmentSchema = z.object({
  hospitalId: z.string().cuid(),
  name: z.string().min(2),
  code: z.string().min(2).max(10).toUpperCase(),
  avgConsultDurationMins: z.number().int().min(5).max(120).default(15),
});

// Consultation log schema
export const endConsultationSchema = z.object({
  appointmentId: z.string().cuid(),
  notes: z.string().max(1000).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<
  typeof updateAppointmentStatusSchema
>;
export type TriageInput = z.infer<typeof triageSchema>;
export type PredictWaitInput = z.infer<typeof predictWaitSchema>;
