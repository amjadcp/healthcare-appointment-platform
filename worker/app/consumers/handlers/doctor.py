"""Handlers for all DOCTOR_* event types."""
import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.schemas.events import DoctorAvailabilityUpdatedPayload, DoctorProvisionedPayload
from app.consumers.helpers.notifications import simulate_email

logger = logging.getLogger("worker.handlers.doctor")


def handle_doctor_provisioned(payload_dict: dict, db: Session) -> None:
    """2.5 DOCTOR_PROVISIONED — Send welcome email to new doctor."""
    payload = DoctorProvisionedPayload(**payload_dict)

    body = (
        f"Dear Dr. {payload.firstName}, your account at {payload.orgName} has been created "
        f"by {payload.provisionedBy}. Please log in at {settings.app_base_url}/login to get started."
    )

    if payload.doctorEmail:
        simulate_email("EMAIL", payload.doctorEmail, f"Welcome to {payload.orgName} — Your account is ready", body)
    else:
        logger.warning(
            "[DOCTOR_PROVISIONED] No email for doctor %s; skipping welcome email", payload.doctorId
        )

    logger.info("[DOCTOR_PROVISIONED] processed doctor %s (%s)", payload.doctorId, payload.doctorEmail)


def handle_doctor_availability_updated(payload_dict: dict, db: Session) -> None:
    """2.6 DOCTOR_AVAILABILITY_UPDATED — Invalidate slot cache (mimicked)."""
    payload = DoctorAvailabilityUpdatedPayload(**payload_dict)

    # Mimicked: in a real system this would call a cache service (Redis/Memcached)
    cache_invalidation = {
        "action": "CACHE_INVALIDATE",
        "key": f"slots:{payload.doctorId}",
        "orgSlug": payload.orgSlug,
        "updatedBy": payload.updatedBy,
        "affectedDays": [s.get("dayOfWeek") if isinstance(s, dict) else None for s in payload.updatedSchedule],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("SIMULATED_CACHE_INVALIDATION: %s", json.dumps(cache_invalidation))
    logger.info(
        "[DOCTOR_AVAILABILITY_UPDATED] processed doctor %s (%s), org=%s",
        payload.doctorId, payload.doctorName, payload.orgSlug,
    )
