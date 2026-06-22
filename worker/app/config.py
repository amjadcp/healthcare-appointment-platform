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
    
    # DLQ routing details
    dlq_exchange: str = "appointment.dlq.exchange"
    dlq_routing_key: str = "appointment.dlq"

    # Active Queue details
    exchange_name: str = "appointment.events"
    queue_name: str = "worker.appointment.queue"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
