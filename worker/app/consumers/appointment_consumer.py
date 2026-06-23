"""Appointment domain consumer — handles appointment.* events."""
from typing import Callable, Dict, List, Tuple

from app.config import settings
from app.consumers.base_consumer import BaseConsumer
from app.consumers.handlers.appointment import (
    handle_appointment_cancelled,
    handle_appointment_completed,
    handle_appointment_confirmed,
    handle_reservation_released,
)


class AppointmentConsumer(BaseConsumer):

    @property
    def queue_bindings(self) -> List[Tuple[str, str]]:
        return [
            (settings.queue_appointment_confirmed, settings.routing_key_appointment_confirmed),
            (settings.queue_appointment_cancelled, settings.routing_key_appointment_cancelled),
            (settings.queue_appointment_completed, settings.routing_key_appointment_completed),
            (settings.queue_reservation_released,  settings.routing_key_reservation_released),
        ]

    @property
    def event_handlers(self) -> Dict[str, Callable[[dict, object], None]]:
        return {
            "APPOINTMENT_CONFIRMED":            handle_appointment_confirmed,
            "APPOINTMENT_CREATED":              handle_appointment_confirmed,  # legacy alias
            "APPOINTMENT_CANCELLED":            handle_appointment_cancelled,
            "APPOINTMENT_COMPLETED":            handle_appointment_completed,
            "APPOINTMENT_RESERVATION_RELEASED": handle_reservation_released,
        }
