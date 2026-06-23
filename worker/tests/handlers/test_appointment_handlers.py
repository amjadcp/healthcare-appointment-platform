"""
Unit tests for appointment event handlers.

Tests are isolated — only the handler function itself is called.
All side-effects (simulate_email, log_appointment_transition) are patched.
"""
import pytest
from unittest.mock import MagicMock, call, patch

from app.consumers.handlers.appointment import (
    handle_appointment_cancelled,
    handle_appointment_completed,
    handle_appointment_confirmed,
    handle_reservation_released,
)

# ── handle_appointment_confirmed ──────────────────────────────────────────────

PATCH_EMAIL = "app.consumers.handlers.appointment.simulate_email"
PATCH_AUDIT = "app.consumers.handlers.appointment.log_appointment_transition"


@patch(PATCH_AUDIT)
@patch(PATCH_EMAIL)
def test_confirmed_sends_email_and_sms_when_both_provided(mock_email, mock_audit):
    db = MagicMock()
    payload = {
        "appointmentId": "apt-001",
        "patientName": "Alice",
        "patientEmail": "alice@example.com",
        "patientPhone": "+1234567890",
        "doctorName": "Dr. Smith",
        "orgName": "Test Clinic",
        "slotStartTime": "2026-06-25T10:00:00Z",
        "paymentMethod": "CARD",
    }
    handle_appointment_confirmed(payload, db)

    assert mock_email.call_count == 2
    assert mock_email.call_args_list[0][0][0] == "EMAIL"
    assert mock_email.call_args_list[1][0][0] == "SMS"
    mock_audit.assert_called_once_with(db, "apt-001", "PENDING_PAYMENT", "CONFIRMED", "EVENT_CONSUMER")


@patch(PATCH_AUDIT)
@patch(PATCH_EMAIL)
def test_confirmed_skips_email_when_no_email(mock_email, mock_audit):
    db = MagicMock()
    payload = {
        "appointmentId": "apt-002",
        "patientName": "Bob",
        "patientPhone": "+9876543210",
    }
    handle_appointment_confirmed(payload, db)

    # Only SMS — no email address available
    assert mock_email.call_count == 1
    assert mock_email.call_args[0][0] == "SMS"


@patch(PATCH_AUDIT)
@patch(PATCH_EMAIL)
def test_confirmed_sends_no_notifications_when_no_contact(mock_email, mock_audit):
    db = MagicMock()
    payload = {"appointmentId": "apt-003", "patientName": "NoContact"}
    handle_appointment_confirmed(payload, db)

    mock_email.assert_not_called()
    mock_audit.assert_called_once()


def test_confirmed_raises_for_dlq_trigger_name():
    """Names containing 'dlq' or 'error' trigger a simulated crash for demo purposes."""
    db = MagicMock()
    with pytest.raises(RuntimeError, match="Simulated processing crash"):
        handle_appointment_confirmed({"appointmentId": "apt-x", "patientName": "DLQ Test Patient"}, db)

    with pytest.raises(RuntimeError, match="Simulated processing crash"):
        handle_appointment_confirmed({"appointmentId": "apt-x", "patientName": "Error Patient"}, db)


# ── handle_appointment_cancelled ──────────────────────────────────────────────

@patch(PATCH_AUDIT)
@patch(PATCH_EMAIL)
def test_cancelled_sends_notifications_and_logs_transition(mock_email, mock_audit):
    db = MagicMock()
    payload = {
        "appointmentId": "apt-010",
        "patientName": "Carol",
        "patientEmail": "carol@example.com",
        "patientPhone": "+1111111111",
        "orgName": "City Clinic",
        "cancelledBy": "ADMIN",
        "reason": "Doctor unavailable",
        "previousStatus": "CONFIRMED",
        "slotStartTime": "2026-06-26T09:00:00Z",
    }
    handle_appointment_cancelled(payload, db)

    assert mock_email.call_count == 2
    mock_audit.assert_called_once_with(db, "apt-010", "CONFIRMED", "CANCELLED", "ADMIN")


# ── handle_appointment_completed ──────────────────────────────────────────────

@patch(PATCH_AUDIT)
@patch(PATCH_EMAIL)
def test_completed_sends_feedback_request(mock_email, mock_audit):
    db = MagicMock()
    payload = {
        "appointmentId": "apt-020",
        "patientName": "Dave",
        "patientEmail": "dave@example.com",
        "doctorName": "Dr. Jones",
        "orgName": "Metro Clinic",
        "completedBy": "DOCTOR",
    }
    handle_appointment_completed(payload, db)

    mock_email.assert_called_once()
    assert mock_email.call_args[0][0] == "EMAIL"
    mock_audit.assert_called_once_with(db, "apt-020", "CONFIRMED", "COMPLETED", "DOCTOR")


# ── handle_reservation_released ───────────────────────────────────────────────

def test_reservation_released_logs_metric(caplog):
    import logging
    db = MagicMock()
    payload = {
        "appointmentId": "apt-030",
        "reason": "TIMEOUT",
        "slotStartTime": "2026-06-27T14:00:00Z",
        "reservedAt": "2026-06-27T13:55:00Z",
        "releasedAt": "2026-06-27T14:01:00Z",
        "orgSlug": "test-clinic",
    }
    with caplog.at_level(logging.INFO, logger="worker.handlers.appointment"):
        handle_reservation_released(payload, db)

    assert "SIMULATED_METRIC" in caplog.text
    assert "RESERVATION_RELEASED" in caplog.text
