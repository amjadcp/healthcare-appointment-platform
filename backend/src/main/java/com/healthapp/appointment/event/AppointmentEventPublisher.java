package com.healthapp.appointment.event;

import com.healthapp.appointment.config.RabbitMQConfig;
import com.healthapp.appointment.model.Appointment;
import com.healthapp.appointment.model.DoctorAvailability;
import com.healthapp.appointment.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class AppointmentEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    // ── §2.1 APPOINTMENT_CONFIRMED ────────────────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleAppointmentConfirmed(LocalAppointmentCreatedEvent event) {
        Appointment appt = event.getAppointment();
        User doctor = appt.getDoctor();

        log.info("Publishing APPOINTMENT_CONFIRMED for appointment ID: {}", appt.getId());

        AppointmentConfirmedPayload payload = new AppointmentConfirmedPayload(
                appt.getId(),
                appt.getPatientName(),
                appt.getPatientEmail(),
                appt.getPatientPhone(),
                doctor.getId(),
                event.getDoctorName(),
                event.getOrgId() != null ? UUID.fromString(event.getOrgId()) : null,
                event.getOrgName(),
                event.getOrgSlug(),
                appt.getSlotStartTime(),
                appt.getSlotEndTime(),
                appt.getPaymentMethod(),
                appt.getStatus().name()
        );

        publish(RabbitMQConfig.ROUTING_KEY_CONFIRMED, "APPOINTMENT_CONFIRMED", payload);
    }

    // ── §2.2 APPOINTMENT_CANCELLED ────────────────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleAppointmentCancelled(LocalAppointmentCancelledEvent event) {
        Appointment appt = event.getAppointment();
        User doctor = appt.getDoctor();

        log.info("Publishing APPOINTMENT_CANCELLED for appointment ID: {}", appt.getId());

        AppointmentCancelledPayload payload = new AppointmentCancelledPayload(
                appt.getId(),
                appt.getPatientName(),
                appt.getPatientEmail(),
                appt.getPatientPhone(),
                doctor.getId(),
                event.getDoctorName(),
                event.getOrgName(),
                event.getOrgSlug(),
                appt.getSlotStartTime(),
                "CONFIRMED",
                appt.getStatus().name(),
                event.getCancelledBy(),
                event.getReason()
        );

        publish(RabbitMQConfig.ROUTING_KEY_CANCELLED, "APPOINTMENT_CANCELLED", payload);
    }

    // ── §2.3 APPOINTMENT_COMPLETED ────────────────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleAppointmentCompleted(LocalAppointmentCompletedEvent event) {
        Appointment appt = event.getAppointment();
        User doctor = appt.getDoctor();

        log.info("Publishing APPOINTMENT_COMPLETED for appointment ID: {}", appt.getId());

        AppointmentCompletedPayload payload = new AppointmentCompletedPayload(
                appt.getId(),
                appt.getPatientName(),
                appt.getPatientEmail(),
                appt.getPatientPhone(),
                doctor.getId(),
                event.getDoctorName(),
                event.getOrgName(),
                event.getOrgSlug(),
                appt.getSlotStartTime(),
                appt.getSlotEndTime(),
                event.getCompletedBy(),
                appt.getStatus().name()
        );

        publish(RabbitMQConfig.ROUTING_KEY_COMPLETED, "APPOINTMENT_COMPLETED", payload);
    }

    // ── §2.4 APPOINTMENT_RESERVATION_RELEASED ────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleReservationReleased(LocalReservationReleasedEvent event) {
        Appointment appt = event.getAppointment();
        User doctor = appt.getDoctor();

        log.info("Publishing APPOINTMENT_RESERVATION_RELEASED for appointment ID: {}", appt.getId());

        ReservationReleasedPayload payload = new ReservationReleasedPayload(
                appt.getId(),
                doctor.getId(),
                event.getOrgId() != null ? UUID.fromString(event.getOrgId()) : null,
                event.getOrgSlug(),
                appt.getSlotStartTime(),
                event.getReservedAt(),
                OffsetDateTime.now(ZoneOffset.UTC),
                event.getReason()
        );

        publish(RabbitMQConfig.ROUTING_KEY_RESERVATION_RELEASED, "APPOINTMENT_RESERVATION_RELEASED", payload);
    }

    // ── §2.5 DOCTOR_PROVISIONED ───────────────────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleDoctorProvisioned(LocalDoctorProvisionedEvent event) {
        User doctor = event.getDoctor();

        log.info("Publishing DOCTOR_PROVISIONED for doctor ID: {}", doctor.getId());

        DoctorProvisionedPayload payload = new DoctorProvisionedPayload(
                doctor.getId(),
                doctor.getEmail(),
                doctor.getFirstName(),
                doctor.getLastName(),
                doctor.getDepartment(),
                doctor.getDegrees(),
                event.getOrgId() != null ? UUID.fromString(event.getOrgId()) : null,
                event.getOrgName(),
                event.getOrgSlug(),
                event.getProvisionedBy()
        );

        publish(RabbitMQConfig.ROUTING_KEY_DOCTOR_PROVISIONED, "DOCTOR_PROVISIONED", payload);
    }

    // ── §2.6 DOCTOR_AVAILABILITY_UPDATED ─────────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleDoctorAvailabilityUpdated(LocalDoctorAvailabilityUpdatedEvent event) {
        User doctor = event.getDoctor();

        log.info("Publishing DOCTOR_AVAILABILITY_UPDATED for doctor ID: {}", doctor.getId());

        List<Map<String, Object>> schedule = event.getUpdatedSchedule().stream()
                .map(a -> Map.<String, Object>of(
                        "dayOfWeek", a.getDayOfWeek().name(),
                        "startTime", a.getStartTime().toString(),
                        "endTime",   a.getEndTime().toString(),
                        "enabled",   true
                ))
                .collect(Collectors.toList());

        DoctorAvailabilityUpdatedPayload payload = new DoctorAvailabilityUpdatedPayload(
                doctor.getId(),
                doctor.getFirstName() + " " + doctor.getLastName(),
                event.getOrgId() != null ? UUID.fromString(event.getOrgId()) : null,
                event.getOrgSlug(),
                event.getUpdatedBy(),
                schedule
        );

        publish(RabbitMQConfig.ROUTING_KEY_AVAILABILITY_UPDATED, "DOCTOR_AVAILABILITY_UPDATED", payload);
    }

    // ── §2.7 ORGANISATION_REGISTERED ─────────────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleOrganisationRegistered(LocalOrganisationRegisteredEvent event) {
        log.info("Publishing ORGANISATION_REGISTERED for org ID: {}", event.getOrganization().getId());

        OrganisationRegisteredPayload payload = new OrganisationRegisteredPayload(
                event.getOrganization().getId(),
                event.getOrganization().getName(),
                event.getOrganization().getSlug(),
                event.getAdmin().getId(),
                event.getAdmin().getEmail(),
                event.getAdmin().getFirstName(),
                event.getAdmin().getLastName(),
                OffsetDateTime.now(ZoneOffset.UTC)
        );

        publish(RabbitMQConfig.ROUTING_KEY_ORG_REGISTERED, "ORGANISATION_REGISTERED", payload);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private <T> void publish(String routingKey, String eventType, T payload) {
        AppointmentEvent<T> envelope = new AppointmentEvent<>(
                UUID.randomUUID(),
                eventType,
                1,
                OffsetDateTime.now(ZoneOffset.UTC),
                "backend",
                payload
        );
        try {
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, routingKey, envelope);
            log.info("Published {} [eventId={}] → routing_key={}", eventType, envelope.getEventId(), routingKey);
        } catch (Exception e) {
            log.error("Failed to publish {} event [eventId={}]: {}", eventType, envelope.getEventId(), e.getMessage(), e);
        }
    }
}
