"""Unit tests for doctor event handlers."""
import logging
from unittest.mock import MagicMock, patch

from app.consumers.handlers.doctor import (
    handle_doctor_availability_updated,
    handle_doctor_provisioned,
)

PATCH_EMAIL = "app.consumers.handlers.doctor.simulate_email"


@patch(PATCH_EMAIL)
def test_provisioned_sends_welcome_email(mock_email):
    db = MagicMock()
    payload = {
        "doctorId": "doc-001",
        "doctorEmail": "drsmith@example.com",
        "firstName": "Smith",
        "orgName": "Test Clinic",
        "orgSlug": "test-clinic",
        "provisionedBy": "admin@clinic.com",
    }
    handle_doctor_provisioned(payload, db)

    mock_email.assert_called_once()
    args = mock_email.call_args[0]
    assert args[0] == "EMAIL"
    assert args[1] == "drsmith@example.com"
    assert "Smith" in args[3]  # body mentions first name


@patch(PATCH_EMAIL)
def test_provisioned_skips_email_when_no_doctor_email(mock_email):
    db = MagicMock()
    payload = {
        "doctorId": "doc-002",
        "doctorEmail": None,
        "firstName": "Jones",
        "orgName": "No-Email Clinic",
    }
    handle_doctor_provisioned(payload, db)
    mock_email.assert_not_called()


def test_availability_updated_logs_cache_invalidation(caplog):
    db = MagicMock()
    payload = {
        "doctorId": "doc-003",
        "doctorName": "Dr. Lee",
        "orgSlug": "city-clinic",
        "updatedBy": "ADMIN",
        "updatedSchedule": [{"dayOfWeek": "MONDAY"}, {"dayOfWeek": "FRIDAY"}],
    }
    with caplog.at_level(logging.INFO, logger="worker.handlers.doctor"):
        handle_doctor_availability_updated(payload, db)

    assert "SIMULATED_CACHE_INVALIDATION" in caplog.text
    assert "doc-003" in caplog.text
