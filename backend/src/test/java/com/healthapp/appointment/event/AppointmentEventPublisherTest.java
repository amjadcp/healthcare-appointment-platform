package com.healthapp.appointment.event;

import com.healthapp.appointment.config.RabbitMQConfig;
import com.healthapp.appointment.model.Appointment;
import com.healthapp.appointment.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class AppointmentEventPublisherTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private AppointmentEventPublisher eventPublisher;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void handleAppointmentCreated_publishesToRabbitMQ() {
        UUID doctorId = UUID.randomUUID();
        User doctor = new User();
        doctor.setId(doctorId);

        UUID appointmentId = UUID.randomUUID();
        Appointment appointment = new Appointment();
        appointment.setId(appointmentId);
        appointment.setDoctor(doctor);
        appointment.setSlotStartTime(OffsetDateTime.now(ZoneOffset.UTC));
        appointment.setSlotEndTime(OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(30));
        appointment.setStatus(Appointment.AppointmentStatus.CONFIRMED);
        appointment.setPatientEmail("patient@example.com");
        appointment.setPatientPhone("+919999999999");

        LocalAppointmentCreatedEvent localEvent = new LocalAppointmentCreatedEvent(appointment);

        eventPublisher.handleAppointmentCreated(localEvent);

        ArgumentCaptor<AppointmentEvent> eventCaptor = ArgumentCaptor.forClass(AppointmentEvent.class);
        verify(rabbitTemplate, times(1)).convertAndSend(
                eq(RabbitMQConfig.EXCHANGE_NAME),
                eq(RabbitMQConfig.ROUTING_KEY_CREATED),
                eventCaptor.capture()
        );

        AppointmentEvent publishedEvent = eventCaptor.getValue();
        assertNotNull(publishedEvent);
        assertEquals("APPOINTMENT_CREATED", publishedEvent.getEventType());
        assertNotNull(publishedEvent.getEventId());

        AppointmentCreatedPayload payload = (AppointmentCreatedPayload) publishedEvent.getPayload();
        assertEquals(appointmentId, payload.getAppointmentId());
        assertEquals(appointmentId, payload.getUserId()); // Anonymous mapping
        assertEquals(doctorId, payload.getDoctorId());
        assertEquals("patient@example.com", payload.getUserEmail());
    }

    @Test
    void handleAppointmentCancelled_publishesToRabbitMQ() {
        UUID doctorId = UUID.randomUUID();
        User doctor = new User();
        doctor.setId(doctorId);

        UUID appointmentId = UUID.randomUUID();
        Appointment appointment = new Appointment();
        appointment.setId(appointmentId);
        appointment.setDoctor(doctor);
        appointment.setStatus(Appointment.AppointmentStatus.CANCELLED);
        appointment.setPatientEmail("patient@example.com");

        LocalAppointmentCancelledEvent localEvent = new LocalAppointmentCancelledEvent(appointment, "PATIENT", "User request");

        eventPublisher.handleAppointmentCancelled(localEvent);

        ArgumentCaptor<AppointmentEvent> eventCaptor = ArgumentCaptor.forClass(AppointmentEvent.class);
        verify(rabbitTemplate, times(1)).convertAndSend(
                eq(RabbitMQConfig.EXCHANGE_NAME),
                eq(RabbitMQConfig.ROUTING_KEY_CANCELLED),
                eventCaptor.capture()
        );

        AppointmentEvent publishedEvent = eventCaptor.getValue();
        assertNotNull(publishedEvent);
        assertEquals("APPOINTMENT_CANCELLED", publishedEvent.getEventType());

        AppointmentCancelledPayload payload = (AppointmentCancelledPayload) publishedEvent.getPayload();
        assertEquals(appointmentId, payload.getAppointmentId());
        assertEquals("CANCELLED", payload.getStatus());
        assertEquals("PATIENT", payload.getCancelledBy());
        assertEquals("User request", payload.getReason());
    }
}
