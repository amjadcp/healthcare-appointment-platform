"""Audit-log helper for appointment status transitions."""
import logging
from typing import Optional

from app.models import AppointmentLog

logger = logging.getLogger("worker.helpers.audit")


def log_appointment_transition(
    db,
    appointment_id: str,
    from_status: Optional[str],
    to_status: str,
    changed_by: str,
) -> None:
    """Write an audit row to appointment_logs."""
    log_entry = AppointmentLog(
        appointment_id=appointment_id,
        from_status=from_status,
        to_status=to_status,
        changed_by=changed_by,
    )
    db.add(log_entry)
