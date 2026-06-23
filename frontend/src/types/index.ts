// ─── Auth / User ─────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'DOCTOR';
export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AuthResponse {
  token: string;
  role: UserRole;
  orgName: string;
  orgSlug: string;
}

// ─── Doctor ───────────────────────────────────────────────────────────────────

export interface Doctor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  degrees: string;
  role: string;
}

export interface Availability {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  enabled?: boolean; // local UI state only
}

// ─── Appointment ──────────────────────────────────────────────────────────────

export type AppointmentStatus = 'RESERVED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type PaymentMethod = 'CASH' | 'CARD' | 'ONLINE';

export interface Appointment {
  id: string;
  patientName: string;
  patientEmail: string | null;
  patientPhone: string;
  doctorName: string;
  slotStartTime: string;
  status: AppointmentStatus;
  paymentMethod: PaymentMethod;
}

export interface ReservePayload {
  patientName: string;
  patientEmail: string | null;
  patientPhone: string;
  doctorId: string;
  slotStartTime: string;
}

export interface SlotResponse {
  slotStartTime: string;
  available: boolean;
  status: string;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
}

// ─── Events / DLQ ────────────────────────────────────────────────────────────

export interface AppointmentEvent {
  id: string;
  eventType: string;
  payload: string; // raw JSON string from backend
  processedAt: string;
  orgSlug?: string;
}

export interface DlqDeath {
  queue: string;
  reason: string;
  count: number;
  firstDeathAt: string;
}

export interface DlqMessage {
  routingKey: string;
  exchange: string;
  payload: Record<string, unknown>;
  deaths: DlqDeath[];
}
