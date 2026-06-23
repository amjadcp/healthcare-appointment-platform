package com.healthapp.appointment.controller;

import com.healthapp.appointment.dto.request.AppointmentRequest;
import com.healthapp.appointment.dto.response.AppointmentResponse;
import com.healthapp.appointment.dto.response.SlotResponse;
import com.healthapp.appointment.service.AppointmentService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class AppointmentController {

    private final AppointmentService appointmentService;

    public AppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @PostMapping("/appointments")
    public ResponseEntity<AppointmentResponse> bookAppointment(@Valid @RequestBody AppointmentRequest request) {
        AppointmentResponse response = appointmentService.bookAppointment(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @PostMapping("/appointments/reserve")
    public ResponseEntity<AppointmentResponse> reserveAppointment(@Valid @RequestBody AppointmentRequest request) {
        AppointmentResponse response = appointmentService.reserveAppointment(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @PostMapping("/appointments/{id}/confirm-payment")
    public ResponseEntity<AppointmentResponse> confirmAppointmentPayment(@PathVariable UUID id) {
        AppointmentResponse response = appointmentService.confirmAppointmentPayment(id);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/appointments/{id}/release")
    public ResponseEntity<Void> releaseAppointmentReservation(@PathVariable UUID id) {
        appointmentService.releaseAppointmentReservation(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/appointments/{id}/complete")
    public ResponseEntity<Void> completeAppointment(@PathVariable UUID id) {
        appointmentService.completeAppointment(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/appointments/{id}")
    public ResponseEntity<Void> cancelAppointment(@PathVariable UUID id) {
        appointmentService.cancelAppointment(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/appointments")
    public ResponseEntity<Page<AppointmentResponse>> getAppointments(@PageableDefault(size = 20) Pageable pageable) {
        Page<AppointmentResponse> response = appointmentService.getAppointments(pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/slots/available")
    public ResponseEntity<List<SlotResponse>> getAvailableSlots(
            @RequestParam UUID doctorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        List<SlotResponse> response = appointmentService.getAvailableSlots(doctorId, date);
        return ResponseEntity.ok(response);
    }
}
