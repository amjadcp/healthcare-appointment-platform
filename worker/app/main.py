import logging
import time
from app.config import settings

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("worker-main")

def main():
    logger.info("Starting Healthcare Appointment Worker...")
    logger.info(f"Connecting to DB: {settings.db_host}:{settings.db_port}/{settings.db_name}")
    logger.info(f"Connecting to RabbitMQ: {settings.rabbitmq_host}:{settings.rabbitmq_port}")
    
    # Placeholder loop
    while True:
        try:
            logger.info("Worker heartbeat - waiting for event consumer initialization...")
            time.sleep(60)
        except KeyboardInterrupt:
            logger.info("Shutting down worker...")
            break

if __name__ == "__main__":
    main()
