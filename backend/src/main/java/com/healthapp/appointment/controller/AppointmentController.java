package com.healthapp.appointment.controller;

import com.healthapp.appointment.dto.request.AppointmentRequest;
import com.healthapp.appointment.dto.response.AppointmentResponse;
import com.healthapp.appointment.dto.response.DlqMessageResponse;
import com.healthapp.appointment.dto.response.SlotResponse;
import com.healthapp.appointment.model.ProcessedEvent;
import com.healthapp.appointment.service.AppointmentService;
import com.healthapp.appointment.service.DlqService;
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
import org.springframework.security.access.prepost.PreAuthorize;
import com.healthapp.appointment.security.UserRole;

@RestController
@RequestMapping("/api/v1")
public class AppointmentController {

    private final AppointmentService appointmentService;
    private final DlqService dlqService;

    public AppointmentController(AppointmentService appointmentService, DlqService dlqService) {
        this.appointmentService = appointmentService;
        this.dlqService = dlqService;
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

    @GetMapping("/events")
    public ResponseEntity<Page<ProcessedEvent>> getProcessedEvents(@PageableDefault(size = 20) Pageable pageable) {
        Page<ProcessedEvent> response = appointmentService.getProcessedEvents(pageable);
        return ResponseEntity.ok(response);
    }

    /**
     * Peek at messages currently sitting in the Dead Letter Queue.
     * Uses ackmode=ack_requeue_true — messages are NOT removed.
     * Requires authentication (admin only — enforced in the service layer).
     */
    @GetMapping("/events/dlq")
    @PreAuthorize("hasRole('" + UserRole.ADMIN + "')")
    public ResponseEntity<List<DlqMessageResponse>> getDlqMessages(
            @RequestParam(defaultValue = "50") int count) {
        List<DlqMessageResponse> messages = dlqService.peekDlqMessages(count);
        return ResponseEntity.ok(messages);
    }

    /** Returns just the count of messages waiting in the DLQ (cheap head-check). */
    @GetMapping("/events/dlq/count")
    @PreAuthorize("hasRole('" + UserRole.ADMIN + "')")
    public ResponseEntity<java.util.Map<String, Long>> getDlqCount() {
        long count = dlqService.getDlqMessageCount();
        return ResponseEntity.ok(java.util.Map.of("count", count));
    }

    /** Reprocesses a specific message from DLQ by eventId, or all if no eventId specified. */
    @PostMapping("/events/dlq/reprocess")
    @PreAuthorize("hasRole('" + UserRole.ADMIN + "')")
    public ResponseEntity<Void> reprocessDlqMessages(@RequestParam(required = false) String eventId) {
        if (eventId != null && !eventId.trim().isEmpty()) {
            boolean success = dlqService.reprocessMessage(eventId);
            if (success) {
                return ResponseEntity.ok().build();
            } else {
                return ResponseEntity.notFound().build();
            }
        } else {
            dlqService.reprocessAll();
            return ResponseEntity.ok().build();
        }
    }

    /** Dismisses (purges) a specific message from DLQ by eventId, or all if no eventId specified. */
    @PostMapping("/events/dlq/dismiss")
    @PreAuthorize("hasRole('" + UserRole.ADMIN + "')")
    public ResponseEntity<Void> dismissDlqMessages(@RequestParam(required = false) String eventId) {
        if (eventId != null && !eventId.trim().isEmpty()) {
            boolean success = dlqService.dismissMessage(eventId);
            if (success) {
                return ResponseEntity.ok().build();
            } else {
                return ResponseEntity.notFound().build();
            }
        } else {
            dlqService.dismissAll();
            return ResponseEntity.ok().build();
        }
    }

    @GetMapping("/slots/available")
    public ResponseEntity<List<SlotResponse>> getAvailableSlots(
            @RequestParam UUID doctorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        List<SlotResponse> response = appointmentService.getAvailableSlots(doctorId, date);
        return ResponseEntity.ok(response);
    }
}
