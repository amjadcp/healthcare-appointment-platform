"""Unit tests for organisation event handler."""
import logging
from unittest.mock import MagicMock, patch

from app.consumers.handlers.organisation import handle_organisation_registered

PATCH_EMAIL = "app.consumers.handlers.organisation.simulate_email"


@patch(PATCH_EMAIL)
def test_org_registered_sends_onboarding_email(mock_email):
    db = MagicMock()
    payload = {
        "orgId": "org-001",
        "orgName": "Green Health",
        "orgSlug": "green-health",
        "adminEmail": "admin@greenhealth.com",
        "adminFirstName": "Alice",
    }
    handle_organisation_registered(payload, db)

    mock_email.assert_called_once()
    args = mock_email.call_args[0]
    assert args[0] == "EMAIL"
    assert args[1] == "admin@greenhealth.com"
    assert "Green Health" in args[3]   # org name appears in body
    assert "green-health" in args[3]   # org slug in the booking link


@patch(PATCH_EMAIL)
def test_org_registered_skips_email_when_no_admin_email(mock_email):
    db = MagicMock()
    payload = {
        "orgId": "org-002",
        "orgName": "Silent Clinic",
        "orgSlug": "silent-clinic",
        "adminEmail": None,
    }
    handle_organisation_registered(payload, db)
    mock_email.assert_not_called()


def test_org_registered_logs_crm_event(caplog):
    db = MagicMock()
    payload = {
        "orgId": "org-003",
        "orgName": "CRM Clinic",
        "orgSlug": "crm-clinic",
        "adminEmail": "crm@clinic.com",
        "adminFirstName": "Bob",
    }
    with caplog.at_level(logging.INFO, logger="worker.handlers.organisation"):
        handle_organisation_registered(payload, db)

    assert "SIMULATED_CRM_EVENT" in caplog.text
    assert "org-003" in caplog.text
