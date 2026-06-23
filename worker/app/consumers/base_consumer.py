"""
BaseConsumer - generic RabbitMQ consumer.

Contains ALL shared infrastructure:
  - Connection & topology declaration
  - Message routing, idempotency check, persistence
  - Retry (with exponential backoff) and DLQ handling

Subclasses only need to declare two things:
  1. queue_bindings  — which queues this domain owns
  2. event_handlers  — which eventType strings it handles
"""
import abc
import json
import logging
from datetime import datetime, timezone
from typing import Callable, Dict, List, Tuple

import pika

from app.config import settings
from app.db import SessionLocal
from app.models import ProcessedEvent

logger = logging.getLogger("worker.base_consumer")


class BaseConsumer(abc.ABC):

    def __init__(self) -> None:
        self.connection = None
        self.channel = None

    # ── Abstract contract ─────────────────────────────────────────────────────

    @property
    @abc.abstractmethod
    def queue_bindings(self) -> List[Tuple[str, str]]:
        """Return [(queue_name, routing_key), …] for every queue this consumer owns."""

    @property
    @abc.abstractmethod
    def event_handlers(self) -> Dict[str, Callable[[dict, object], None]]:
        """Return {eventType: handler_fn} for every event type this consumer handles."""

    # ── Connection & topology ─────────────────────────────────────────────────

    def connect(self) -> None:
        logger.info(
            "[%s] Connecting to RabbitMQ: %s:%s",
            self._name, settings.rabbitmq_host, settings.rabbitmq_port,
        )
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
        self._declare_topology()

    def _declare_topology(self) -> None:
        """
        Declare shared exchanges / infrastructure queues, then this consumer's event queues.
        All declarations are idempotent — safe to call from multiple consumer instances.
        """
        self.channel.exchange_declare(
            exchange=settings.exchange_name, exchange_type="topic", durable=True,
        )
        self.channel.exchange_declare(
            exchange=settings.dlq_exchange, exchange_type="direct", durable=True,
        )
        self.channel.exchange_declare(
            exchange=settings.retry_exchange, exchange_type="topic", durable=True,
        )

        self.channel.queue_declare(queue=settings.dlq_queue, durable=True)
        self.channel.queue_bind(
            exchange=settings.dlq_exchange,
            queue=settings.dlq_queue,
            routing_key=settings.dlq_routing_key,
        )

        self.channel.queue_declare(
            queue=settings.retry_queue,
            durable=True,
            arguments={"x-dead-letter-exchange": settings.exchange_name},
        )
        self.channel.queue_bind(
            exchange=settings.retry_exchange, queue=settings.retry_queue, routing_key="#",
        )

        dlq_args = {
            "x-dead-letter-exchange":    settings.dlq_exchange,
            "x-dead-letter-routing-key": settings.dlq_routing_key,
            "x-message-ttl":             60 * 60 * 1000,   # 1 hour in ms
        }
        for queue_name, routing_key in self.queue_bindings:
            self.channel.queue_declare(queue=queue_name, durable=True, arguments=dlq_args)
            self.channel.queue_bind(
                exchange=settings.exchange_name,
                queue=queue_name,
                routing_key=routing_key,
            )
            logger.info(
                "[%s] Bound queue '%s' → '%s' (DLQ-enabled)",
                self._name, queue_name, routing_key,
            )

        self.channel.basic_qos(prefetch_count=1)
        logger.info("[%s] Topology declared successfully.", self._name)

    def start_consuming(self) -> None:
        for queue_name, _ in self.queue_bindings:
            self.channel.basic_consume(queue=queue_name, on_message_callback=self.on_message)
            logger.info("[%s] Consuming from queue: %s", self._name, queue_name)

        logger.info("[%s] Ready — waiting for messages.", self._name)
        try:
            self.channel.start_consuming()
        except KeyboardInterrupt:
            logger.info("[%s] Stopping consumer...", self._name)
            self.stop()

    def stop(self) -> None:
        if self.channel:
            self.channel.stop_consuming()
        if self.connection and not self.connection.is_closed:
            self.connection.close()

    def on_message(self, ch, method, properties, body: bytes) -> None:
        """Thin orchestrator - delegates to focused private methods."""
        routing_key = method.routing_key
        retry_count = self._get_retry_count(properties)
        logger.info(
            "[%s] Received from '%s' (retry=%d): %s",
            self._name, routing_key, retry_count, body[:200],
        )
        db = SessionLocal()
        try:
            event = self._parse_envelope(body)

            if self._is_duplicate(event["eventId"], db):
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            if event["eventType"] not in self.event_handlers:
                logger.warning(
                    "[%s] No handler for event type '%s'. Routing to DLQ.",
                    self._name, event["eventType"],
                )
                self._send_to_dlq(
                    ch, body,
                    ValueError(f"Unknown event type: {event['eventType']}"),
                    retry_count,
                )
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            self._dispatch_and_persist(event, db)
            logger.info(
                "[%s] Processed event %s (%s)", self._name, event["eventId"], event["eventType"],
            )
            ch.basic_ack(delivery_tag=method.delivery_tag)

        except Exception as exc:
            db.rollback()
            self._handle_retry_or_dlq(ch, method, properties, body, exc, retry_count)
        finally:
            db.close()

    def _parse_envelope(self, body: bytes) -> dict:
        event = json.loads(body.decode("utf-8"))
        if not event.get("eventId") or not event.get("eventType"):
            raise ValueError("Missing eventId or eventType in event envelope")
        return event

    def _is_duplicate(self, event_id: str, db) -> bool:
        existing = db.query(ProcessedEvent).filter(ProcessedEvent.id == event_id).first()
        if existing:
            logger.info("Event %s already processed — skipping (idempotent)", event_id)
            return True
        return False

    def _dispatch_and_persist(self, event: dict, db) -> None:
        event_id   = event["eventId"]
        event_type = event["eventType"]
        payload    = event.get("payload", {})

        self.event_handlers[event_type](payload, db)

        db.add(ProcessedEvent(
            id=event_id,
            event_type=event_type,
            org_slug=payload.get("orgSlug"),
            payload=json.dumps(event),
        ))
        db.commit()

    def _handle_retry_or_dlq(
        self, ch, method, properties, body: bytes, exc: Exception, retry_count: int,
    ) -> None:
        headers = dict(getattr(properties, "headers", None) or {})
        routing_key = method.routing_key

        if retry_count < settings.max_retries:
            retry_count += 1
            delay_ms = 1000 * retry_count   # 1 s, 2 s, 3 s …
            headers["x-retry-count"] = retry_count
            headers["x-last-error"]  = str(exc)
            headers["x-failed-at"]   = datetime.now(timezone.utc).isoformat()
            logger.warning(
                "[%s] Attempt %d/%d from '%s'. Retrying in %d ms. Error: %s",
                self._name, retry_count, settings.max_retries, routing_key, delay_ms, exc,
            )
            ch.basic_publish(
                exchange=settings.retry_exchange,
                routing_key=routing_key,
                body=body,
                properties=pika.BasicProperties(
                    delivery_mode=2, headers=headers, expiration=str(delay_ms),
                ),
            )
        else:
            logger.error(
                "[%s] Max retries (%d) reached for '%s'. Routing to DLQ. Error: %s",
                self._name, settings.max_retries, routing_key, exc,
            )
            self._send_to_dlq(ch, body, exc, retry_count)

        ch.basic_ack(delivery_tag=method.delivery_tag)

    def _send_to_dlq(self, ch, raw_body: bytes, error: Exception, death_count: int = 0) -> None:
        try:
            original = json.loads(raw_body.decode("utf-8"))
        except Exception:
            original = {"raw_payload": raw_body.decode("utf-8", errors="ignore")}

        dlq_message = {
            "originalEvent": original,
            "error": {
                "message": str(error),
                "failedAt": datetime.now(timezone.utc).isoformat(),
                "deathCount": death_count,
                "reason": "NO_HANDLER",
            },
        }
        try:
            ch.basic_publish(
                exchange=settings.dlq_exchange,
                routing_key=settings.dlq_routing_key,
                body=json.dumps(dlq_message),
                properties=pika.BasicProperties(delivery_mode=2),
            )
            logger.info("[%s] Published to DLQ (%s)", self._name, settings.dlq_queue)
        except Exception as dlq_err:
            logger.error("[%s] Failed to publish to DLQ: %s", self._name, dlq_err)

    def _get_retry_count(self, properties) -> int:
        headers = getattr(properties, "headers", None) or {}
        return int(headers.get("x-retry-count", 0))

    def _get_death_count(self, properties) -> int:
        headers = getattr(properties, "headers", None) or {}
        x_death = headers.get("x-death", [])
        return int(x_death[0].get("count", 1)) if x_death else 0

    @property
    def _name(self) -> str:
        """Shorthand for logging — avoids repeating self.__class__.__name__ everywhere."""
        return self.__class__.__name__
