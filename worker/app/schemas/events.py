"""
Pydantic models for each RabbitMQ event payload.

These replace raw dict.get() calls in handlers, giving:
  - Automatic validation (missing required fields raise ValidationError)
  - Typed attributes (no implicit None surprises)
  - Self-documenting field contracts
"""
from __future__ import annotations

from typing import Any, List, Optional, Union

from pydantic import BaseModel


# ── Appointment events ────────────────────────────────────────────────────────

class AppointmentConfirmedPayload(BaseModel):
    appointmentId: str
    patientName: str = "Patient"
    patientEmail: Optional[str] = None
    patientPhone: Optional[str] = None
    doctorName: str = "the doctor"
    orgName: str = "the clinic"
    slotStartTime: Optional[Union[str, float, int]] = None
    paymentMethod: str = "CASH"


class AppointmentCancelledPayload(BaseModel):
    appointmentId: str
    patientName: str = "Patient"
    patientEmail: Optional[str] = None
    patientPhone: Optional[str] = None
    orgName: str = "the clinic"
    cancelledBy: str = "PATIENT"
    reason: str = "No reason provided"
    previousStatus: str = "CONFIRMED"
    slotStartTime: Optional[Union[str, float, int]] = None


class AppointmentCompletedPayload(BaseModel):
    appointmentId: str
    patientName: str = "Patient"
    patientEmail: Optional[str] = None
    patientPhone: Optional[str] = None
    doctorName: str = "the doctor"
    orgName: str = "the clinic"
    completedBy: str = "SYSTEM"


class ReservationReleasedPayload(BaseModel):
    appointmentId: str
    reason: str = "UNKNOWN"
    slotStartTime: Optional[Union[str, float, int]] = None
    reservedAt: Optional[Union[str, float, int]] = None
    releasedAt: Optional[Union[str, float, int]] = None
    orgSlug: str = "unknown"


# ── Doctor events ─────────────────────────────────────────────────────────────

class DoctorProvisionedPayload(BaseModel):
    doctorId: str
    doctorEmail: Optional[str] = None
    firstName: str = "Doctor"
    orgName: str = "the clinic"
    orgSlug: str = ""
    provisionedBy: str = "ADMIN"


class ScheduleEntry(BaseModel):
    dayOfWeek: Optional[str] = None


class DoctorAvailabilityUpdatedPayload(BaseModel):
    doctorId: str
    doctorName: str = "Unknown Doctor"
    orgSlug: str = "unknown"
    updatedBy: str = "ADMIN"
    updatedSchedule: List[Any] = []


# ── Organisation events ───────────────────────────────────────────────────────

class OrganisationRegisteredPayload(BaseModel):
    orgId: str
    orgName: str = "Your Clinic"
    orgSlug: str = ""
    adminEmail: Optional[str] = None
    adminFirstName: str = "Admin"
