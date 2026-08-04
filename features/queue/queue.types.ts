import { AppointmentStatus, AppointmentType } from "@prisma/client";

export interface QueueEntryWithPatient {
  id: string;
  appointmentId: string;
  position: number;
  estimatedWaitMins: number;
  predictionConfidence: number;
  virtualWaitingRoom: boolean;
  appointment: {
    id: string;
    tokenNumber: number;
    status: AppointmentStatus;
    appointmentType: AppointmentType;
    isEmergency: boolean;
    scheduledAt: Date;
    notes: string | null;
    patient: {
      id: string;
      name: string;
      email: string;
    };
  };
}

export interface QueueSnapshot {
  currentToken: number;
  yourToken: number;
  patientsAhead: number;
  estimatedWaitMins: number;
  confidence: number;
  showVirtualWaiting: boolean;
}

export interface PositionUpdate {
  appointmentId: string;
  position: number;
  estimatedWaitMins: number;
  confidence: number;
  patientsAhead: number;
}
