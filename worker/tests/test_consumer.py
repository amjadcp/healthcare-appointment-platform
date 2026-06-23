"""
Integration-style tests for the on_message routing pipeline.

These test the full BaseConsumer.on_message flow through AppointmentConsumer,
covering: success, idempotent skip, retry-on-error, and DLQ-on-max-retries.

SessionLocal is patched at its source (base_consumer) since that is where
on_message imports and calls it.
"""
import json
import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.consumers.appointment_consumer import AppointmentConsumer

SESSION_PATCH = "app.consumers.base_consumer.SessionLocal"


@pytest.fixture
def consumer():
    c = AppointmentConsumer()
    c.channel = MagicMock()
    return c


@patch(SESSION_PATCH)
def test_on_message_success(mock_session_local, consumer):
    """A valid, unprocessed event is handled, persisted, and acknowledged."""
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query().filter().first.return_value = None  # not a duplicate

    event_body = {
        "eventId": str(uuid.uuid4()),
        "eventType": "APPOINTMENT_CREATED",
        "payload": {
            "appointmentId": str(uuid.uuid4()),
            "patientName": "Jane",
            "slotStartTime": "2026-06-25T10:00:00Z",
        },
    }
    body = json.dumps(event_body).encode("utf-8")
    method = MagicMock(delivery_tag=1)

    consumer.on_message(consumer.channel, method, MagicMock(), body)

    mock_db.commit.assert_called_once()
    consumer.channel.basic_ack.assert_called_once_with(delivery_tag=1)


@patch(SESSION_PATCH)
def test_on_message_idempotent_skip(mock_session_local, consumer):
    """A duplicate event (already in processed_events) is ack'd without processing."""
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query().filter().first.return_value = MagicMock()  # already processed

    event_body = {
        "eventId": str(uuid.uuid4()),
        "eventType": "APPOINTMENT_CREATED",
        "payload": {"appointmentId": str(uuid.uuid4())},
    }
    body = json.dumps(event_body).encode("utf-8")
    method = MagicMock(delivery_tag=1)

    consumer.on_message(consumer.channel, method, MagicMock(), body)

    mock_db.commit.assert_not_called()
    consumer.channel.basic_ack.assert_called_once_with(delivery_tag=1)


@patch(SESSION_PATCH)
def test_on_message_retry_on_error(mock_session_local, consumer):
    """A DB error triggers a retry publish to the retry exchange."""
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query.side_effect = Exception("DB Connection Lost")

    event_body = {
        "eventId": str(uuid.uuid4()),
        "eventType": "APPOINTMENT_CREATED",
        "payload": {"appointmentId": str(uuid.uuid4())},
    }
    body = json.dumps(event_body).encode("utf-8")
    method = MagicMock(delivery_tag=1)
    properties = MagicMock()
    properties.headers = {}

    consumer.on_message(consumer.channel, method, properties, body)

    mock_db.rollback.assert_called_once()
    consumer.channel.basic_publish.assert_called_once()
    publish_kwargs = consumer.channel.basic_publish.call_args[1]
    assert publish_kwargs["exchange"] == "appointment.retry.exchange"
    assert publish_kwargs["properties"].headers["x-retry-count"] == 1
    consumer.channel.basic_ack.assert_called_once_with(delivery_tag=1)


@patch(SESSION_PATCH)
def test_on_message_dlq_on_max_retries(mock_session_local, consumer):
    """After max_retries exhausted, message is routed to the DLQ exchange."""
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query.side_effect = Exception("DB Connection Lost")

    event_body = {
        "eventId": str(uuid.uuid4()),
        "eventType": "APPOINTMENT_CREATED",
        "payload": {"appointmentId": str(uuid.uuid4())},
    }
    body = json.dumps(event_body).encode("utf-8")
    method = MagicMock(delivery_tag=1)
    properties = MagicMock()
    properties.headers = {"x-retry-count": 3}   # already at max_retries

    consumer.on_message(consumer.channel, method, properties, body)

    mock_db.rollback.assert_called_once()
    consumer.channel.basic_publish.assert_called_once()
    publish_kwargs = consumer.channel.basic_publish.call_args[1]
    assert publish_kwargs["exchange"] == "appointment.dlq.exchange"
    assert publish_kwargs["routing_key"] == "appointment.dlq"
    consumer.channel.basic_ack.assert_called_once_with(delivery_tag=1)
