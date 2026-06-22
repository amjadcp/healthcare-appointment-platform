package com.healthapp.appointment.service;

import com.healthapp.appointment.dto.request.AppointmentRequest;
import com.healthapp.appointment.dto.response.AppointmentResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface AppointmentService {
    AppointmentResponse bookAppointment(AppointmentRequest request);
    void cancelAppointment(UUID appointmentId);
    List<OffsetDateTime> getAvailableSlots(UUID doctorId, LocalDate date);
    Page<AppointmentResponse> getAppointments(Pageable pageable);
}
