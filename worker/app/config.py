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

    # Exchange
    exchange_name: str = "appointment.events"

    # DLQ
    dlq_exchange: str = "appointment.dlq.exchange"
    dlq_routing_key: str = "appointment.dlq"
    dlq_queue: str = "worker.dlq"

    # Per-event queues (matching event-contracts.md §7)
    queue_appointment_confirmed: str = "worker.appointment.confirmed"
    queue_appointment_cancelled: str = "worker.appointment.cancelled"
    queue_appointment_completed: str = "worker.appointment.completed"
    queue_reservation_released:  str = "worker.reservation.released"
    queue_doctor_provisioned:    str = "worker.doctor.provisioned"
    queue_availability_updated:  str = "worker.availability.updated"
    queue_org_registered:        str = "worker.organisation.registered"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
