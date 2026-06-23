"""
Handlers package.

Each domain consumer imports directly from the handler submodule it needs:
  - app.consumers.handlers.appointment
  - app.consumers.handlers.doctor
  - app.consumers.handlers.organisation

The combined EVENT_HANDLERS dict has been removed; each consumer class now
declares its own event_handlers property, keeping domain boundaries clean.
"""
