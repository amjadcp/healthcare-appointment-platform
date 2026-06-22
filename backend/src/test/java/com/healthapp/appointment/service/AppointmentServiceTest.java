package com.healthapp.appointment.service;

import com.healthapp.appointment.dto.request.AppointmentRequest;
import com.healthapp.appointment.dto.response.AppointmentResponse;
import com.healthapp.appointment.exception.ConflictException;
import com.healthapp.appointment.mapper.AppointmentMapper;
import com.healthapp.appointment.model.Appointment;
import com.healthapp.appointment.model.User;
import com.healthapp.appointment.repository.AppointmentLogRepository;
import com.healthapp.appointment.repository.AppointmentRepository;
import com.healthapp.appointment.repository.DoctorAvailabilityRepository;
import com.healthapp.appointment.repository.UserRepository;
import com.healthapp.appointment.service.impl.AppointmentServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AppointmentServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private DoctorAvailabilityRepository availabilityRepository;

    @Mock
    private AppointmentRepository appointmentRepository;

    @Mock
    private AppointmentLogRepository logRepository;

    @Mock
    private AppointmentMapper appointmentMapper;

    @Mock
    private org.springframework.context.ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private AppointmentServiceImpl appointmentService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void bookAppointment_success() {
        UUID doctorId = UUID.randomUUID();
        User doctor = new User();
        doctor.setId(doctorId);
        doctor.setRole(User.Role.DOCTOR);

        // A future slot aligned on a 30-min boundary
        OffsetDateTime slotTime = OffsetDateTime.now(ZoneOffset.UTC).plusDays(1).withMinute(0).withSecond(0).withNano(0);

        AppointmentRequest request = new AppointmentRequest(
                "Patient Name", "patient@email.com", "+919999999999", doctorId, slotTime
        );

        when(userRepository.findById(doctorId)).thenReturn(Optional.of(doctor));
        when(availabilityRepository.findByDoctorIdAndDayOfWeek(eq(doctorId), any())).thenReturn(Optional.empty()); // Defaults to 9-5
        when(appointmentRepository.existsByDoctorIdAndSlotStartTimeAndStatusNot(eq(doctorId), eq(slotTime), any())).thenReturn(false);
        when(appointmentRepository.save(any(Appointment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(appointmentMapper.toResponse(any(Appointment.class))).thenReturn(new AppointmentResponse(
                UUID.randomUUID(), "Patient Name", "patient@email.com", "+919999999999", doctorId, "Dr. Jane Smith", slotTime, slotTime.plusMinutes(30), "CONFIRMED", "CASH", 0L
        ));

        AppointmentResponse response = appointmentService.bookAppointment(request);

        assertNotNull(response);
        assertEquals("Patient Name", response.getPatientName());
        verify(appointmentRepository, times(1)).save(any(Appointment.class));
        verify(logRepository, times(1)).save(any());
    }

    @Test
    void bookAppointment_duplicateSlot_throwsConflictException() {
        UUID doctorId = UUID.randomUUID();
        User doctor = new User();
        doctor.setId(doctorId);
        doctor.setRole(User.Role.DOCTOR);

        OffsetDateTime slotTime = OffsetDateTime.now(ZoneOffset.UTC).plusDays(1).withMinute(30).withSecond(0).withNano(0);

        AppointmentRequest request = new AppointmentRequest(
                "Patient Name", "patient@email.com", "+919999999999", doctorId, slotTime
        );

        when(userRepository.findById(doctorId)).thenReturn(Optional.of(doctor));
        when(availabilityRepository.findByDoctorIdAndDayOfWeek(eq(doctorId), any())).thenReturn(Optional.empty());
        when(appointmentRepository.existsByDoctorIdAndSlotStartTimeAndStatusNot(eq(doctorId), eq(slotTime), any())).thenReturn(true);

        assertThrows(ConflictException.class, () -> appointmentService.bookAppointment(request));
        verify(appointmentRepository, never()).save(any(Appointment.class));
    }

    @Test
    void cancelAppointment_success() {
        UUID appointmentId = UUID.randomUUID();
        Appointment appointment = new Appointment();
        appointment.setId(appointmentId);
        appointment.setStatus(Appointment.AppointmentStatus.CONFIRMED);

        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(appointment));

        appointmentService.cancelAppointment(appointmentId);

        assertEquals(Appointment.AppointmentStatus.CANCELLED, appointment.getStatus());
        verify(appointmentRepository, times(1)).save(appointment);
        verify(logRepository, times(1)).save(any());
    }

    @Test
    void cancelAppointment_alreadyCancelled_idempotent() {
        UUID appointmentId = UUID.randomUUID();
        Appointment appointment = new Appointment();
        appointment.setId(appointmentId);
        appointment.setStatus(Appointment.AppointmentStatus.CANCELLED);

        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(appointment));

        appointmentService.cancelAppointment(appointmentId);

        verify(appointmentRepository, never()).save(any(Appointment.class));
        verify(logRepository, never()).save(any());
    }

    @Test
    void getAvailableSlots_correctness() {
        UUID doctorId = UUID.randomUUID();
        User doctor = new User();
        doctor.setId(doctorId);
        doctor.setRole(User.Role.DOCTOR);

        LocalDate date = LocalDate.now().plusDays(2); // In the future, so none are filtered by past-time check

        when(userRepository.findById(doctorId)).thenReturn(Optional.of(doctor));
        when(availabilityRepository.findByDoctorIdAndDayOfWeek(eq(doctorId), any())).thenReturn(Optional.empty()); // 9-5 defaults (16 slots of 30 mins)
        when(appointmentRepository.findByDoctorIdAndSlotStartTimeBetweenAndStatusNot(eq(doctorId), any(), any(), any()))
                .thenReturn(Collections.emptyList());

        List<OffsetDateTime> slots = appointmentService.getAvailableSlots(doctorId, date);

        assertNotNull(slots);
        assertEquals(16, slots.size()); // 9:00 AM to 5:00 PM has 16 slots (9:00, 9:30, ..., 16:30)
    }
}
