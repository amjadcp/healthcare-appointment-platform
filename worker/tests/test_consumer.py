import json
import uuid
from unittest.mock import MagicMock, patch
import pytest
from app.consumers.appointment_consumer import AppointmentConsumer

@pytest.fixture
def consumer():
    c = AppointmentConsumer()
    c.channel = MagicMock()
    return c

@patch("app.consumers.appointment_consumer.SessionLocal")
def test_on_message_success_created(mock_session_local, consumer):
    # Mock Database Session
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    
    # Configure DB query to return None (event not yet processed)
    mock_db.query().filter().first.return_value = None

    # Construct APPOINTMENT_CREATED mock event
    event_id = str(uuid.uuid4())
    appointment_id = str(uuid.uuid4())
    doctor_id = str(uuid.uuid4())
    event_body = {
        "eventId": event_id,
        "eventType": "APPOINTMENT_CREATED",
        "payload": {
            "appointmentId": appointment_id,
            "doctorId": doctor_id,
            "userEmail": "patient@example.com",
            "slotStartTime": "2026-06-25T10:00:00Z"
        }
    }
    body = json.dumps(event_body).encode("utf-8")

    # Call on_message
    method = MagicMock()
    method.delivery_tag = 1
    consumer.on_message(consumer.channel, method, MagicMock(), body)

    # Verify database commits
    mock_db.commit.assert_called_once()
    
    # Verify message is acknowledged
    consumer.channel.basic_ack.assert_called_once_with(delivery_tag=1)

@patch("app.consumers.appointment_consumer.SessionLocal")
def test_on_message_idempotent_skip(mock_session_local, consumer):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    
    # Configure DB query to return an existing ProcessedEvent (already processed)
    mock_db.query().filter().first.return_value = MagicMock()

    event_body = {
        "eventId": str(uuid.uuid4()),
        "eventType": "APPOINTMENT_CREATED",
        "payload": {
            "appointmentId": str(uuid.uuid4())
        }
    }
    body = json.dumps(event_body).encode("utf-8")

    method = MagicMock()
    method.delivery_tag = 1
    consumer.on_message(consumer.channel, method, MagicMock(), body)

    # Verify database is NOT committed for duplicate
    mock_db.commit.assert_not_called()
    
    # Verify message is acknowledged (skipped)
    consumer.channel.basic_ack.assert_called_once_with(delivery_tag=1)

@patch("app.consumers.appointment_consumer.SessionLocal")
def test_on_message_dlq_on_error(mock_session_local, consumer):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    
    # Simulate DB error during query (throws exception)
    mock_db.query.side_effect = Exception("DB Connection Lost")

    event_body = {
        "eventId": str(uuid.uuid4()),
        "eventType": "APPOINTMENT_CREATED",
        "payload": {
            "appointmentId": str(uuid.uuid4())
        }
    }
    body = json.dumps(event_body).encode("utf-8")

    method = MagicMock()
    method.delivery_tag = 1
    
    # on_message catches exception internally and routes to DLQ
    consumer.on_message(consumer.channel, method, MagicMock(), body)

    # Verify db transaction rolled back
    mock_db.rollback.assert_called_once()
    
    # Verify DLQ publish was called
    consumer.channel.basic_publish.assert_called_once()
    
    # Verify original message acknowledged (removed from main queue)
    consumer.channel.basic_ack.assert_called_once_with(delivery_tag=1)
