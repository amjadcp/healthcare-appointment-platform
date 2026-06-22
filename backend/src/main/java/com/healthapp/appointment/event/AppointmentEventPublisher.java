package com.healthapp.appointment.event;

import com.healthapp.appointment.config.RabbitMQConfig;
import com.healthapp.appointment.model.Appointment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Component
public class AppointmentEventPublisher {

    private static final Logger logger = LoggerFactory.getLogger(AppointmentEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    public AppointmentEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleAppointmentCreated(LocalAppointmentCreatedEvent event) {
        Appointment appointment = event.getAppointment();
        logger.info("Transaction committed. Publishing APPOINTMENT_CREATED event for appointment ID: {}", appointment.getId());

        AppointmentCreatedPayload payload = new AppointmentCreatedPayload(
                appointment.getId(),
                appointment.getId(), // For anonymous patients, we map userId to the unique appointment ID
                appointment.getDoctor().getId(),
                appointment.getSlotStartTime(),
                appointment.getSlotEndTime(),
                appointment.getStatus().name(),
                appointment.getPatientEmail(),
                appointment.getPatientPhone()
        );

        AppointmentEvent<AppointmentCreatedPayload> amqpEvent = new AppointmentEvent<>(
                UUID.randomUUID(),
                "APPOINTMENT_CREATED",
                1,
                OffsetDateTime.now(ZoneOffset.UTC),
                "backend",
                payload
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_NAME,
                RabbitMQConfig.ROUTING_KEY_CREATED,
                amqpEvent
        );
        logger.info("Successfully published APPOINTMENT_CREATED event with ID: {}", amqpEvent.getEventId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleAppointmentCancelled(LocalAppointmentCancelledEvent event) {
        Appointment appointment = event.getAppointment();
        logger.info("Transaction committed. Publishing APPOINTMENT_CANCELLED event for appointment ID: {}", appointment.getId());

        AppointmentCancelledPayload payload = new AppointmentCancelledPayload(
                appointment.getId(),
                appointment.getId(),
                appointment.getDoctor().getId(),
                event.getAppointment().getStatus().name(), // Or previous status before CANCELLED, but status is now CANCELLED in DB
                "CANCELLED",
                event.getCancelledBy(),
                event.getReason(),
                appointment.getPatientEmail()
        );

        AppointmentEvent<AppointmentCancelledPayload> amqpEvent = new AppointmentEvent<>(
                UUID.randomUUID(),
                "APPOINTMENT_CANCELLED",
                1,
                OffsetDateTime.now(ZoneOffset.UTC),
                "backend",
                payload
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_NAME,
                RabbitMQConfig.ROUTING_KEY_CANCELLED,
                amqpEvent
        );
        logger.info("Successfully published APPOINTMENT_CANCELLED event with ID: {}", amqpEvent.getEventId());
    }
}
