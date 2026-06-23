import json
import logging
from datetime import datetime, timezone
import pika
from sqlalchemy.exc import IntegrityError
from app.config import settings
from app.db import SessionLocal
from app.models import ProcessedEvent, AppointmentLog

logger = logging.getLogger("worker.appointment_consumer")


# ── Mimicked side-effect helpers ─────────────────────────────────────────────

def _simulate_email(notification_type: str, recipient: str, subject: str, body: str):
    """Emit a structured log that mimics an email/SMS dispatch."""
    log = {
        "notification_type": notification_type,
        "recipient": recipient,
        "subject": subject,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "body": body,
    }
    logger.info("SIMULATED_NOTIFICATION: %s", json.dumps(log))


def _log_appointment_transition(db, appointment_id: str, from_status, to_status: str, changed_by: str):
    """Write an audit row to appointment_logs."""
    log_entry = AppointmentLog(
        appointment_id=appointment_id,
        from_status=from_status,
        to_status=to_status,
        changed_by=changed_by,
    )
    db.add(log_entry)


# ── Per-event handlers ────────────────────────────────────────────────────────

def handle_appointment_confirmed(payload: dict, db):
    """2.1 APPOINTMENT_CONFIRMED — Send confirmation notification."""
    appointment_id = payload.get("appointmentId")
    patient_name   = payload.get("patientName", "Patient")
    patient_email  = payload.get("patientEmail")
    patient_phone  = payload.get("patientPhone")
    doctor_name    = payload.get("doctorName", "the doctor")
    org_name       = payload.get("orgName", "the clinic")
    slot_start     = payload.get("slotStartTime")
    payment_method = payload.get("paymentMethod", "CASH")

    body = (
        f"Dear {patient_name}, your appointment with {doctor_name} at {org_name} "
        f"is confirmed on {slot_start}. Payment method: {payment_method}."
    )

    if patient_email:
        _simulate_email("EMAIL", patient_email, f"Appointment Confirmed — {org_name}", body)
    else:
        logger.info("Skipping email: no patient email for appointment %s", appointment_id)

    if patient_phone:
        _simulate_email("SMS", patient_phone, "Appointment Confirmed", body)

    _log_appointment_transition(db, appointment_id, "PENDING_PAYMENT", "CONFIRMED", "EVENT_CONSUMER")
    logger.info("[APPOINTMENT_CONFIRMED] processed appointment %s", appointment_id)


def handle_appointment_cancelled(payload: dict, db):
    """2.2 APPOINTMENT_CANCELLED — Send cancellation notification."""
    appointment_id = payload.get("appointmentId")
    patient_name   = payload.get("patientName", "Patient")
    patient_email  = payload.get("patientEmail")
    patient_phone  = payload.get("patientPhone")
    org_name       = payload.get("orgName", "the clinic")
    cancelled_by   = payload.get("cancelledBy", "PATIENT")
    reason         = payload.get("reason", "No reason provided")
    prev_status    = payload.get("previousStatus", "CONFIRMED")
    slot_start     = payload.get("slotStartTime")

    body = (
        f"Dear {patient_name}, your appointment ({slot_start}) at {org_name} "
        f"has been cancelled by {cancelled_by}. Reason: {reason}."
    )

    if patient_email:
        _simulate_email("EMAIL", patient_email, f"Appointment Cancelled — {org_name}", body)
    else:
        logger.info("Skipping email: no patient email for appointment %s", appointment_id)

    if patient_phone:
        _simulate_email("SMS", patient_phone, "Appointment Cancelled", body)

    _log_appointment_transition(db, appointment_id, prev_status, "CANCELLED", cancelled_by)
    logger.info("[APPOINTMENT_CANCELLED] processed appointment %s", appointment_id)


def handle_appointment_completed(payload: dict, db):
    """2.3 APPOINTMENT_COMPLETED — Send post-visit feedback request."""
    appointment_id = payload.get("appointmentId")
    patient_name   = payload.get("patientName", "Patient")
    patient_email  = payload.get("patientEmail")
    patient_phone  = payload.get("patientPhone")
    doctor_name    = payload.get("doctorName", "the doctor")
    org_name       = payload.get("orgName", "the clinic")
    completed_by   = payload.get("completedBy", "SYSTEM")

    feedback_body = (
        f"Dear {patient_name}, your visit with {doctor_name} at {org_name} is complete. "
        f"We'd love your feedback! Please rate your experience at https://feedback.example.com."
    )

    if patient_email:
        _simulate_email("EMAIL", patient_email, f"How was your visit? — {org_name}", feedback_body)
    else:
        logger.info("Skipping feedback email: no patient email for appointment %s", appointment_id)

    if patient_phone:
        _simulate_email("SMS", patient_phone, "Rate your visit", feedback_body)

    _log_appointment_transition(db, appointment_id, "CONFIRMED", "COMPLETED", completed_by)
    logger.info("[APPOINTMENT_COMPLETED] processed appointment %s (completedBy=%s)", appointment_id, completed_by)


def handle_reservation_released(payload: dict, db):
    """2.4 APPOINTMENT_RESERVATION_RELEASED — Log abandonment metric."""
    appointment_id = payload.get("appointmentId")
    reason         = payload.get("reason", "UNKNOWN")
    slot_start     = payload.get("slotStartTime")
    reserved_at    = payload.get("reservedAt")
    released_at    = payload.get("releasedAt")
    org_slug       = payload.get("orgSlug", "unknown")

    # Mimicked: in a real system this would write to an analytics/metrics store
    abandonment_metric = {
        "metric": "slot_reservation_abandoned",
        "appointmentId": appointment_id,
        "reason": reason,
        "slotStartTime": slot_start,
        "reservedAt": reserved_at,
        "releasedAt": released_at,
        "orgSlug": org_slug,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("SIMULATED_METRIC: %s", json.dumps(abandonment_metric))
    logger.info(
        "[RESERVATION_RELEASED] appointment %s released (reason=%s, slot=%s)",
        appointment_id, reason, slot_start
    )
    # No appointment_log write: row was hard-deleted; this event IS the record.


def handle_doctor_provisioned(payload: dict, db):
    """2.5 DOCTOR_PROVISIONED — Send welcome email to new doctor."""
    doctor_id    = payload.get("doctorId")
    doctor_email = payload.get("doctorEmail")
    first_name   = payload.get("firstName", "Doctor")
    org_name     = payload.get("orgName", "the clinic")
    org_slug     = payload.get("orgSlug", "")
    provisioned_by = payload.get("provisionedBy", "ADMIN")

    portal_url = f"https://app.example.com/login"

    body = (
        f"Dear Dr. {first_name}, your account at {org_name} has been created by {provisioned_by}. "
        f"Please log in at {portal_url} to get started."
    )

    if doctor_email:
        _simulate_email("EMAIL", doctor_email, f"Welcome to {org_name} — Your account is ready", body)
    else:
        logger.warning("[DOCTOR_PROVISIONED] No email for doctor %s; skipping welcome email", doctor_id)

    logger.info("[DOCTOR_PROVISIONED] processed doctor %s (%s)", doctor_id, doctor_email)


def handle_doctor_availability_updated(payload: dict, db):
    """2.6 DOCTOR_AVAILABILITY_UPDATED — Invalidate slot cache (mimicked)."""
    doctor_id   = payload.get("doctorId")
    doctor_name = payload.get("doctorName", "Unknown Doctor")
    org_slug    = payload.get("orgSlug", "unknown")
    updated_by  = payload.get("updatedBy", "ADMIN")
    schedule    = payload.get("updatedSchedule", [])

    # Mimicked: in a real system this would call a cache service (Redis/Memcached)
    cache_invalidation = {
        "action": "CACHE_INVALIDATE",
        "key": f"slots:{doctor_id}",
        "orgSlug": org_slug,
        "updatedBy": updated_by,
        "affectedDays": [s.get("dayOfWeek") for s in schedule],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("SIMULATED_CACHE_INVALIDATION: %s", json.dumps(cache_invalidation))
    logger.info(
        "[DOCTOR_AVAILABILITY_UPDATED] processed doctor %s (%s), org=%s",
        doctor_id, doctor_name, org_slug
    )


def handle_organisation_registered(payload: dict, db):
    """2.7 ORGANISATION_REGISTERED — Send onboarding email to new admin."""
    org_id         = payload.get("orgId")
    org_name       = payload.get("orgName", "Your Clinic")
    org_slug       = payload.get("orgSlug", "")
    admin_email    = payload.get("adminEmail")
    admin_name     = payload.get("adminFirstName", "Admin")

    onboarding_body = (
        f"Welcome to the platform, {admin_name}! Your clinic '{org_name}' is now registered.\n\n"
        f"Get started:\n"
        f"  1. Log in at https://app.example.com/login\n"
        f"  2. Add your doctors under the Admin Portal\n"
        f"  3. Set their availability\n"
        f"  4. Share your patient booking link: https://app.example.com/o/{org_slug}\n\n"
        f"Questions? Reply to this email."
    )

    if admin_email:
        _simulate_email("EMAIL", admin_email, f"Welcome to the platform — {org_name} is ready!", onboarding_body)
    else:
        logger.warning("[ORGANISATION_REGISTERED] No admin email for org %s; skipping welcome email", org_id)

    # Mimicked: trigger CRM/billing trial
    crm_event = {
        "action": "CRM_CONTACT_CREATED",
        "orgId": org_id,
        "orgName": org_name,
        "adminEmail": admin_email,
        "trialStarted": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("SIMULATED_CRM_EVENT: %s", json.dumps(crm_event))
    logger.info("[ORGANISATION_REGISTERED] processed org %s (%s)", org_id, org_name)


# ── Event type dispatch table ─────────────────────────────────────────────────

EVENT_HANDLERS = {
    "APPOINTMENT_CONFIRMED":            handle_appointment_confirmed,
    "APPOINTMENT_CREATED":              handle_appointment_confirmed,  # legacy alias
    "APPOINTMENT_CANCELLED":            handle_appointment_cancelled,
    "APPOINTMENT_COMPLETED":            handle_appointment_completed,
    "APPOINTMENT_RESERVATION_RELEASED": handle_reservation_released,
    "DOCTOR_PROVISIONED":               handle_doctor_provisioned,
    "DOCTOR_AVAILABILITY_UPDATED":      handle_doctor_availability_updated,
    "ORGANISATION_REGISTERED":          handle_organisation_registered,
}


# ── Consumer ──────────────────────────────────────────────────────────────────

class AppointmentConsumer:
    def __init__(self):
        self.connection = None
        self.channel = None

    def connect(self):
        logger.info("Connecting to RabbitMQ: %s:%s", settings.rabbitmq_host, settings.rabbitmq_port)
        credentials = pika.PlainCredentials(settings.rabbitmq_user, settings.rabbitmq_password)
        self.connection = pika.BlockingConnection(
            pika.ConnectionParameters(
                host=settings.rabbitmq_host,
                port=settings.rabbitmq_port,
                credentials=credentials,
                heartbeat=600,
                blocked_connection_timeout=300,
            )
        )
        self.channel = self.connection.channel()

        # Declare main topic exchange
        self.channel.exchange_declare(
            exchange=settings.exchange_name,
            exchange_type="topic",
            durable=True,
        )

        # Declare DLQ exchange + queue
        self.channel.exchange_declare(
            exchange=settings.dlq_exchange,
            exchange_type="direct",
            durable=True,
        )
        self.channel.queue_declare(queue=settings.dlq_queue, durable=True)
        self.channel.queue_bind(
            exchange=settings.dlq_exchange,
            queue=settings.dlq_queue,
            routing_key=settings.dlq_routing_key,
        )

        # Declare and bind all per-event queues
        queue_bindings = [
            (settings.queue_appointment_confirmed, "appointment.confirmed"),
            (settings.queue_appointment_cancelled, "appointment.cancelled"),
            (settings.queue_appointment_completed, "appointment.completed"),
            (settings.queue_reservation_released,  "appointment.reservation.released"),
            (settings.queue_doctor_provisioned,     "doctor.provisioned"),
            (settings.queue_availability_updated,   "doctor.availability.updated"),
            (settings.queue_org_registered,         "organisation.registered"),
        ]
        for queue_name, routing_key in queue_bindings:
            self.channel.queue_declare(queue=queue_name, durable=True)
            self.channel.queue_bind(
                exchange=settings.exchange_name,
                queue=queue_name,
                routing_key=routing_key,
            )
            logger.info("Bound queue '%s' → routing_key '%s'", queue_name, routing_key)

        self.channel.basic_qos(prefetch_count=1)
        logger.info("RabbitMQ topology declared successfully.")

    def start_consuming(self):
        """Register a consumer on every per-event queue."""
        all_queues = [
            settings.queue_appointment_confirmed,
            settings.queue_appointment_cancelled,
            settings.queue_appointment_completed,
            settings.queue_reservation_released,
            settings.queue_doctor_provisioned,
            settings.queue_availability_updated,
            settings.queue_org_registered,
        ]
        for queue_name in all_queues:
            self.channel.basic_consume(
                queue=queue_name,
                on_message_callback=self.on_message,
            )
            logger.info("Consuming from queue: %s", queue_name)

        logger.info("Worker ready — waiting for messages.")
        try:
            self.channel.start_consuming()
        except KeyboardInterrupt:
            logger.info("Stopping RabbitMQ consumer...")
            self.stop()

    def stop(self):
        if self.channel:
            self.channel.stop_consuming()
        if self.connection and not self.connection.is_closed:
            self.connection.close()

    def on_message(self, ch, method, properties, body):
        logger.info("Received message from queue '%s': %s", method.routing_key, body[:200])
        db = SessionLocal()
        try:
            event      = json.loads(body.decode("utf-8"))
            event_id   = event.get("eventId")
            event_type = event.get("eventType")
            payload    = event.get("payload", {})

            if not event_id or not event_type:
                raise ValueError("Missing eventId or eventType in event envelope")

            # Idempotency check
            existing = db.query(ProcessedEvent).filter(ProcessedEvent.id == event_id).first()
            if existing:
                logger.info("Event %s already processed — skipping (idempotent)", event_id)
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            # Dispatch to handler
            handler = EVENT_HANDLERS.get(event_type)
            if handler:
                handler(payload, db)
            else:
                logger.warning("Unknown event type '%s' — no handler registered. Routing to DLQ.", event_type)
                self._send_to_dlq(ch, body, ValueError(f"Unknown event type: {event_type}"))
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            # Mark as processed
            org_slug = payload.get("orgSlug")
            db.add(ProcessedEvent(
                id=event_id,
                event_type=event_type,
                org_slug=org_slug,
                payload=body.decode("utf-8")
            ))
            db.commit()
            logger.info("Successfully processed event %s (%s)", event_id, event_type)
            ch.basic_ack(delivery_tag=method.delivery_tag)

        except Exception as exc:
            db.rollback()
            logger.exception("Error handling event: %s", exc)
            self._send_to_dlq(ch, body, exc)
            ch.basic_ack(delivery_tag=method.delivery_tag)
        finally:
            db.close()

    def _send_to_dlq(self, ch, raw_body: bytes, error: Exception):
        """Wrap the original message with error metadata and publish to DLQ."""
        try:
            original = json.loads(raw_body.decode("utf-8"))
        except Exception:
            original = {"raw_payload": raw_body.decode("utf-8", errors="ignore")}

        dlq_message = {
            "originalEvent": original,
            "error": {
                "message": str(error),
                "failedAt": datetime.now(timezone.utc).isoformat(),
                "retryCount": 1,
            },
        }
        try:
            ch.basic_publish(
                exchange=settings.dlq_exchange,
                routing_key=settings.dlq_routing_key,
                body=json.dumps(dlq_message),
                properties=pika.BasicProperties(delivery_mode=2),
            )
            logger.info("Published failed event to DLQ (%s)", settings.dlq_queue)
        except Exception as dlq_err:
            logger.error("Failed to publish to DLQ: %s", dlq_err)
