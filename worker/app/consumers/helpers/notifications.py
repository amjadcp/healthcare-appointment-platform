"""Simulated notification helpers (email / SMS side-effects)."""
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger("worker.helpers.notifications")


def simulate_email(notification_type: str, recipient: str, subject: str, body: str) -> None:
    """Emit a structured log that mimics an email/SMS dispatch."""
    log = {
        "notification_type": notification_type,
        "recipient": recipient,
        "subject": subject,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "body": body,
    }
    logger.info("SIMULATED_NOTIFICATION: %s", json.dumps(log))
