"""
Starts each domain consumer in its own thread:
  - AppointmentConsumer  → worker.appointment.*, worker.reservation.*
  - DoctorConsumer       → worker.doctor.*, worker.availability.*
  - OrganisationConsumer → worker.organisation.*
"""
import logging
import threading
import time

from app.config import settings
from app.consumers.appointment_consumer import AppointmentConsumer
from app.consumers.doctor_consumer import DoctorConsumer
from app.consumers.organisation_consumer import OrganisationConsumer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("worker.main")


def run_consumer(consumer) -> None:
    name = type(consumer).__name__
    while True:
        try:
            consumer.connect()
            consumer.start_consuming()
        except KeyboardInterrupt:
            logger.info("[%s] Shutdown requested.", name)
            consumer.stop()
            break
        except Exception as exc:
            logger.warning(
                "[%s] Connection lost, reconnecting in %d seconds. Error: %s",
                name, settings.reconnect_delay_seconds, exc
            )
            consumer.stop()
            time.sleep(settings.reconnect_delay_seconds)


def main() -> None:
    logger.info("Starting Healthcare Appointment Worker...")
    logger.info(
        "Target Database: %s:%s/%s", settings.db_host, settings.db_port, settings.db_name
    )
    logger.info("Target RabbitMQ: %s:%s", settings.rabbitmq_host, settings.rabbitmq_port)

    consumers = [
        AppointmentConsumer(),
        DoctorConsumer(),
        OrganisationConsumer(),
    ]

    threads = [
        threading.Thread(
            target=run_consumer,
            args=(consumer,),
            name=type(consumer).__name__,
            daemon=True,   # threads die automatically when main process exits
        )
        for consumer in consumers
    ]

    for thread in threads:
        thread.start()
        logger.info("Started consumer thread: %s", thread.name)

    try:
        # Keep main thread alive; daemon threads run until process exits
        for thread in threads:
            thread.join()
    except KeyboardInterrupt:
        logger.info("Shutting down all consumer threads...")
        for consumer in consumers:
            consumer.stop()


if __name__ == "__main__":
    main()
