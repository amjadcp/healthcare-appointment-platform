"""Doctor domain consumer — handles doctor.* events."""
from typing import Callable, Dict, List, Tuple

from app.config import settings
from app.consumers.base_consumer import BaseConsumer
from app.consumers.handlers.doctor import (
    handle_doctor_availability_updated,
    handle_doctor_provisioned,
)


class DoctorConsumer(BaseConsumer):

    @property
    def queue_bindings(self) -> List[Tuple[str, str]]:
        return [
            (settings.queue_doctor_provisioned,  settings.routing_key_doctor_provisioned),
            (settings.queue_availability_updated, settings.routing_key_availability_updated),
        ]

    @property
    def event_handlers(self) -> Dict[str, Callable[[dict, object], None]]:
        return {
            "DOCTOR_PROVISIONED":          handle_doctor_provisioned,
            "DOCTOR_AVAILABILITY_UPDATED": handle_doctor_availability_updated,
        }
