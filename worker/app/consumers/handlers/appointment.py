"""Handlers for all APPOINTMENT_* and RESERVATION_* event types."""
import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.schemas.events import (
    AppointmentCancelledPayload,
    AppointmentCompletedPayload,
    AppointmentConfirmedPayload,
    ReservationReleasedPayload,
)
from app.consumers.helpers.audit import log_appointment_transition
from app.consumers.helpers.notifications import simulate_email

logger = logging.getLogger("worker.handlers.appointment")


def handle_appointment_confirmed(payload_dict: dict, db: Session) -> None:
    payload = AppointmentConfirmedPayload(**payload_dict)
    # Simulate processing crash for DLQ demonstration
    if "dlq" in payload.patientName.lower() or "error" in payload.patientName.lower():
        raise RuntimeError(f"Simulated processing crash for patient: {payload.patientName}!")

    body = (
        f"Dear {payload.patientName}, your appointment with {payload.doctorName} at {payload.orgName} "
        f"is confirmed on {payload.slotStartTime}. Payment method: {payload.paymentMethod}."
    )

    if payload.patientEmail:
        simulate_email("EMAIL", payload.patientEmail, f"Appointment Confirmed — {payload.orgName}", body)
    else:
        logger.info("Skipping email: no patient email for appointment %s", payload.appointmentId)

    if payload.patientPhone:
        simulate_email("SMS", payload.patientPhone, "Appointment Confirmed", body)

    log_appointment_transition(db, payload.appointmentId, "PENDING_PAYMENT", "CONFIRMED", "EVENT_CONSUMER")
    logger.info("[APPOINTMENT_CONFIRMED] processed appointment %s", payload.appointmentId)


def handle_appointment_cancelled(payload_dict: dict, db: Session) -> None:
    payload = AppointmentCancelledPayload(**payload_dict)

    body = (
        f"Dear {payload.patientName}, your appointment ({payload.slotStartTime}) at {payload.orgName} "
        f"has been cancelled by {payload.cancelledBy}. Reason: {payload.reason}."
    )

    if payload.patientEmail:
        simulate_email("EMAIL", payload.patientEmail, f"Appointment Cancelled — {payload.orgName}", body)
    else:
        logger.info("Skipping email: no patient email for appointment %s", payload.appointmentId)

    if payload.patientPhone:
        simulate_email("SMS", payload.patientPhone, "Appointment Cancelled", body)

    log_appointment_transition(db, payload.appointmentId, payload.previousStatus, "CANCELLED", payload.cancelledBy)
    logger.info("[APPOINTMENT_CANCELLED] processed appointment %s", payload.appointmentId)


def handle_appointment_completed(payload_dict: dict, db: Session) -> None:
    payload = AppointmentCompletedPayload(**payload_dict)

    feedback_body = (
        f"Dear {payload.patientName}, your visit with {payload.doctorName} at {payload.orgName} is complete. "
        f"We'd love your feedback! Please rate your experience at {settings.feedback_url}."
    )

    if payload.patientEmail:
        simulate_email("EMAIL", payload.patientEmail, f"How was your visit? — {payload.orgName}", feedback_body)
    else:
        logger.info("Skipping feedback email: no patient email for appointment %s", payload.appointmentId)

    if payload.patientPhone:
        simulate_email("SMS", payload.patientPhone, "Rate your visit", feedback_body)

    log_appointment_transition(db, payload.appointmentId, "CONFIRMED", "COMPLETED", payload.completedBy)
    logger.info(
        "[APPOINTMENT_COMPLETED] processed appointment %s (completedBy=%s)",
        payload.appointmentId, payload.completedBy,
    )


def handle_reservation_released(payload_dict: dict, db: Session) -> None:
    payload = ReservationReleasedPayload(**payload_dict)

    # Mimic writing to an analytics/metrics store
    abandonment_metric = {
        "metric": "slot_reservation_abandoned",
        "appointmentId": payload.appointmentId,
        "reason": payload.reason,
        "slotStartTime": payload.slotStartTime,
        "reservedAt": payload.reservedAt,
        "releasedAt": payload.releasedAt,
        "orgSlug": payload.orgSlug,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("SIMULATED_METRIC: %s", json.dumps(abandonment_metric))
    logger.info(
        "[RESERVATION_RELEASED] appointment %s released (reason=%s, slot=%s)",
        payload.appointmentId, payload.reason, payload.slotStartTime,
    )
    # No appointment_log write: row was hard-deleted; this event IS the record.
