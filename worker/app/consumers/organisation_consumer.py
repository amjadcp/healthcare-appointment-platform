"""Organisation domain consumer — handles organisation.* events."""
from typing import Callable, Dict, List, Tuple

from app.config import settings
from app.consumers.base_consumer import BaseConsumer
from app.consumers.handlers.organisation import handle_organisation_registered


class OrganisationConsumer(BaseConsumer):

    @property
    def queue_bindings(self) -> List[Tuple[str, str]]:
        return [
            (settings.queue_org_registered, settings.routing_key_org_registered),
        ]

    @property
    def event_handlers(self) -> Dict[str, Callable[[dict, object], None]]:
        return {
            "ORGANISATION_REGISTERED": handle_organisation_registered,
        }
