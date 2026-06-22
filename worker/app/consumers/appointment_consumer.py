import json
import logging
from datetime import datetime, timezone
import pika
from sqlalchemy.exc import IntegrityError
from app.config import settings
from app.db import SessionLocal
from app.models import ProcessedEvent, AppointmentLog

logger = logging.getLogger("worker.appointment_consumer")

class AppointmentConsumer:
    def __init__(self):
        self.connection = None
        self.channel = None

    def connect(self):
        logger.info(f"Connecting to RabbitMQ: {settings.rabbitmq_host}:{settings.rabbitmq_port}")
        credentials = pika.PlainCredentials(settings.rabbitmq_user, settings.rabbitmq_password)
        self.connection = pika.BlockingConnection(
            pika.ConnectionParameters(
                host=settings.rabbitmq_host,
                port=settings.rabbitmq_port,
                credentials=credentials,
                heartbeat=600,
                blocked_connection_timeout=300
            )
        )
        self.channel = self.connection.channel()

        # Declare active exchange, queue and bindings
        self.channel.exchange_declare(
            exchange=settings.exchange_name,
            exchange_type="topic",
            durable=True
        )
        self.channel.queue_declare(
            queue=settings.queue_name,
            durable=True
        )
        # Bind queue to routing keys
        self.channel.queue_bind(
            exchange=settings.exchange_name,
            queue=self.queue_name_created(),
            routing_key="appointment.created"
        )
        self.channel.queue_bind(
            exchange=settings.exchange_name,
            queue=self.queue_name_cancelled(),
            routing_key="appointment.cancelled"
        )

        # Declare and bind DLQ queue
        self.channel.exchange_declare(
            exchange=settings.dlq_exchange,
            exchange_type="direct",
            durable=True
        )
        self.channel.queue_declare(
            queue=settings.dlq_routing_key,
            durable=True
        )
        self.channel.queue_bind(
            exchange=settings.dlq_exchange,
            queue=settings.dlq_routing_key,
            routing_key=settings.dlq_routing_key
        )

        # Prefetch 1 message at a time
        self.channel.basic_qos(prefetch_count=1)

    def queue_name_created(self):
        return settings.queue_name

    def queue_name_cancelled(self):
        return settings.queue_name

    def start_consuming(self):
        logger.info(f"Starting consumer on queue: {settings.queue_name}")
        self.channel.basic_consume(
            queue=settings.queue_name,
            on_message_callback=self.on_message
        )
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
        logger.info(f"Received raw message: {body}")
        db = SessionLocal()
        try:
            # Parse message envelope
            event = json.loads(body.decode("utf-8"))
            event_id = event.get("eventId")
            event_type = event.get("eventType")
            payload = event.get("payload", {})

            if not event_id or not event_type:
                raise ValueError("Missing eventId or eventType in event envelope")

            # 1. Idempotency Check
            existing = db.query(ProcessedEvent).filter(ProcessedEvent.id == event_id).first()
            if existing:
                logger.info(f"Event {event_id} already processed. Skipping.")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            # 2. Process Event based on Type
            appointment_id = payload.get("appointmentId")
            if not appointment_id:
                raise ValueError("Missing appointmentId in event payload")

            if event_type == "APPOINTMENT_CREATED":
                email = payload.get("userEmail")
                doctor_id = payload.get("doctorId")
                slot_start = payload.get("slotStartTime")
                
                # Simulate Notification dispatch (structured log output)
                notification_log = {
                    "notification_type": "EMAIL",
                    "recipient": email,
                    "subject": "Appointment Booked Successfully",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "body": f"Dear Patient, your appointment with Doctor ({doctor_id}) is confirmed on {slot_start}."
                }
                logger.info(f"SIMULATED_NOTIFICATION: {json.dumps(notification_log)}")

                # Write audit log status entry
                log_entry = AppointmentLog(
                    appointment_id=appointment_id,
                    from_status=None,
                    to_status="CONFIRMED",
                    changed_by="EVENT_CONSUMER"
                )
                db.add(log_entry)

            elif event_type == "APPOINTMENT_CANCELLED":
                email = payload.get("userEmail")
                prev_status = payload.get("previousStatus", "CONFIRMED")
                cancelled_by = payload.get("cancelledBy", "PATIENT")
                reason = payload.get("reason", "No reason provided")

                # Simulate Cancellation Notification
                notification_log = {
                    "notification_type": "EMAIL",
                    "recipient": email,
                    "subject": "Appointment Cancelled",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "body": f"Dear Patient, your appointment ({appointment_id}) has been cancelled by {cancelled_by}. Reason: {reason}."
                }
                logger.info(f"SIMULATED_NOTIFICATION: {json.dumps(notification_log)}")

                # Write audit log status entry
                log_entry = AppointmentLog(
                    appointment_id=appointment_id,
                    from_status=prev_status,
                    to_status="CANCELLED",
                    changed_by=cancelled_by
                )
                db.add(log_entry)
            else:
                logger.warning(f"Unknown event type: {event_type}. Skipping payload logic.")

            # Record event in processed_events for idempotency
            processed_event = ProcessedEvent(
                id=event_id,
                event_type=event_type
            )
            db.add(processed_event)

            # Commit the transaction
            db.commit()
            logger.info(f"Successfully processed event {event_id} ({event_type})")
            
            # Acknowledge the message
            ch.basic_ack(delivery_tag=method.delivery_tag)

        except Exception as e:
            db.rollback()
            logger.exception(f"Error handling event: {str(e)}")

            # Dead Letter Queue Routing (Wrap original message with error metadata)
            try:
                raw_envelope = json.loads(body.decode("utf-8"))
            except Exception:
                raw_envelope = {"raw_payload": body.decode("utf-8", errors="ignore")}

            dlq_message = {
                "originalEvent": raw_envelope,
                "error": {
                    "message": str(e),
                    "failedAt": datetime.now(timezone.utc).isoformat(),
                    "retryCount": 1
                }
            }

            try:
                ch.basic_publish(
                    exchange=settings.dlq_exchange,
                    routing_key=settings.dlq_routing_key,
                    body=json.dumps(dlq_message),
                    properties=pika.BasicProperties(delivery_mode=2)  # Persistent
                )
                logger.info("Published failed event copy to DLQ exchange.")
            except Exception as dlq_err:
                logger.error(f"Failed to publish to DLQ exchange: {str(dlq_err)}")

            # Acknowledge original message anyway to prevent queue blocking
            ch.basic_ack(delivery_tag=method.delivery_tag)
        finally:
            db.close()
