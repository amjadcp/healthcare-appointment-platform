import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "appointment_db"
    db_user: str = "postgres"
    db_password: str = "postgres_password"

    rabbitmq_host: str = "localhost"
    rabbitmq_port: int = 5672
    rabbitmq_user: str = "guest"
    rabbitmq_password: str = "guest"

    # Application URLs
    app_base_url: str = "https://app.example.com"
    feedback_url: str = "https://feedback.example.com"

    # Exchange
    exchange_name: str = "appointment.events"

    # DLQ
    dlq_exchange: str = "appointment.dlq.exchange"
    dlq_routing_key: str = "appointment.dlq"
    dlq_queue: str = "worker.dlq"

    # Retry
    retry_exchange: str = "appointment.retry.exchange"
    retry_queue: str = "worker.retry.queue"
    max_retries: int = 3
    retry_initial_interval_ms: int = 1000

    # Dedicated Queues
    queue_appointment_confirmed: str = "worker.appointment.confirmed"
    queue_appointment_cancelled: str = "worker.appointment.cancelled"
    queue_appointment_completed: str = "worker.appointment.completed"
    queue_reservation_released:  str = "worker.reservation.released"
    queue_doctor_provisioned:    str = "worker.doctor.provisioned"
    queue_availability_updated:  str = "worker.availability.updated"
    queue_org_registered:        str = "worker.organisation.registered"

    # Routing keys
    routing_key_appointment_confirmed: str = "appointment.confirmed"
    routing_key_appointment_cancelled: str = "appointment.cancelled"
    routing_key_appointment_completed: str = "appointment.completed"
    routing_key_reservation_released:  str = "appointment.reservation.released"
    routing_key_doctor_provisioned:    str = "doctor.provisioned"
    routing_key_availability_updated:  str = "doctor.availability.updated"
    routing_key_org_registered:        str = "organisation.registered"

    # RabbitMQ Connection & Topology Settings
    rabbitmq_heartbeat: int = 600
    rabbitmq_blocked_connection_timeout: int = 300
    rabbitmq_prefetch_count: int = 1
    rabbitmq_message_ttl: int = 3600000  # 1 hour in ms
    reconnect_delay_seconds: int = 5

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Local development convenience: map docker service names to 127.0.0.1
# if we are running outside of Docker (forces IPv4 to avoid Windows Docker Desktop IPv6 issues)
if not os.path.exists("/.dockerenv"):
    if settings.db_host == "postgres":
        settings.db_host = "127.0.0.1"
    if settings.rabbitmq_host == "rabbitmq":
        settings.rabbitmq_host = "127.0.0.1"
