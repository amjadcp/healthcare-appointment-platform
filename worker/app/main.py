import logging
import time
from app.config import settings
from app.consumers.appointment_consumer import AppointmentConsumer

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("worker-main")

def main():
    logger.info("Starting Healthcare Appointment Worker...")
    logger.info(f"Target Database: {settings.db_host}:{settings.db_port}/{settings.db_name}")
    logger.info(f"Target RabbitMQ: {settings.rabbitmq_host}:{settings.rabbitmq_port}")
    
    consumer = AppointmentConsumer()
    
    # Retry connection in case RabbitMQ is still booting up
    while True:
        try:
            consumer.connect()
            break
        except Exception as e:
            logger.warning(f"Failed to connect to RabbitMQ/DB, retrying in 5 seconds... Error: {e}")
            time.sleep(5)

    try:
        consumer.start_consuming()
    except KeyboardInterrupt:
        logger.info("Shutting down worker...")
        consumer.stop()

if __name__ == "__main__":
    main()
