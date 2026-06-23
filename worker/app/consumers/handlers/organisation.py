"""Handler for ORGANISATION_REGISTERED event type."""
import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.schemas.events import OrganisationRegisteredPayload
from app.consumers.helpers.notifications import simulate_email

logger = logging.getLogger("worker.handlers.organisation")


def handle_organisation_registered(payload_dict: dict, db: Session) -> None:
    """2.7 ORGANISATION_REGISTERED — Send onboarding email to new admin."""
    payload = OrganisationRegisteredPayload(**payload_dict)

    onboarding_body = (
        f"Welcome to the platform, {payload.adminFirstName}! "
        f"Your clinic '{payload.orgName}' is now registered.\n\n"
        f"Get started:\n"
        f"  1. Log in at {settings.app_base_url}/login\n"
        f"  2. Add your doctors under the Admin Portal\n"
        f"  3. Set their availability\n"
        f"  4. Share your patient booking link: {settings.app_base_url}/o/{payload.orgSlug}\n\n"
        f"Questions? Reply to this email."
    )

    if payload.adminEmail:
        simulate_email(
            "EMAIL",
            payload.adminEmail,
            f"Welcome to the platform — {payload.orgName} is ready!",
            onboarding_body,
        )
    else:
        logger.warning(
            "[ORGANISATION_REGISTERED] No admin email for org %s; skipping welcome email", payload.orgId
        )

    # Mimicked: trigger CRM/billing trial
    crm_event = {
        "action": "CRM_CONTACT_CREATED",
        "orgId": payload.orgId,
        "orgName": payload.orgName,
        "adminEmail": payload.adminEmail,
        "trialStarted": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("SIMULATED_CRM_EVENT: %s", json.dumps(crm_event))
    logger.info("[ORGANISATION_REGISTERED] processed org %s (%s)", payload.orgId, payload.orgName)
