package com.healthapp.appointment.service;

import com.healthapp.appointment.dto.request.AppointmentRequest;
import com.healthapp.appointment.dto.response.AppointmentResponse;
import com.healthapp.appointment.dto.response.SlotResponse;
import com.healthapp.appointment.model.ProcessedEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface AppointmentService {
    AppointmentResponse bookAppointment(AppointmentRequest request);
    AppointmentResponse reserveAppointment(AppointmentRequest request);
    AppointmentResponse confirmAppointmentPayment(UUID appointmentId);
    void releaseAppointmentReservation(UUID appointmentId);
    void completeAppointment(UUID appointmentId);
    void cancelAppointment(UUID appointmentId);
    List<SlotResponse> getAvailableSlots(UUID doctorId, LocalDate date);
    Page<AppointmentResponse> getAppointments(Pageable pageable);
    Page<ProcessedEvent> getProcessedEvents(Pageable pageable);
}
