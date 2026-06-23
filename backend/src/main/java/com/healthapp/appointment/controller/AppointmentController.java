package com.healthapp.appointment.controller;

import com.healthapp.appointment.dto.request.AppointmentRequest;
import com.healthapp.appointment.dto.response.AppointmentLogResponse;
import com.healthapp.appointment.dto.response.AppointmentResponse;
import com.healthapp.appointment.dto.response.DlqMessageResponse;
import com.healthapp.appointment.dto.response.SlotResponse;
import com.healthapp.appointment.model.ProcessedEvent;
import com.healthapp.appointment.service.AppointmentService;
import com.healthapp.appointment.service.DlqService;
import com.healthapp.appointment.security.UserRole;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
@RequiredArgsConstructor
@Tag(name = "Appointment Management", description = "Endpoints for booking, slots, auditing, and RabbitMQ DLQ management")
public class AppointmentController {

    private final AppointmentService appointmentService;
    private final DlqService dlqService;

    @PostMapping("/appointments")
    @Operation(
        summary = "Book an Appointment",
        description = "Performs an atomic, immediate booking flow: reserves the selected doctor availability slot and instantly confirms payment.",
        responses = {
            @ApiResponse(responseCode = "201", description = "Appointment successfully booked", content = @Content(schema = @Schema(implementation = AppointmentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid time, unaligned boundary, past slot, or user is not a doctor"),
            @ApiResponse(responseCode = "409", description = "Slot is already booked or temporarily held for payment")
        }
    )
    public ResponseEntity<AppointmentResponse> bookAppointment(@Valid @RequestBody AppointmentRequest request) {
        AppointmentResponse response = appointmentService.bookAppointment(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @PostMapping("/appointments/reserve")
    @Operation(
        summary = "Reserve an Appointment Slot (2-Step Flow)",
        description = "Creates a temporary reservation (30-second hold) for the selected slot, allowing the patient to proceed to payment.",
        responses = {
            @ApiResponse(responseCode = "201", description = "Slot successfully reserved", content = @Content(schema = @Schema(implementation = AppointmentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid slots or request format"),
            @ApiResponse(responseCode = "409", description = "Slot is already booked or temporarily held")
        }
    )
    public ResponseEntity<AppointmentResponse> reserveAppointment(@Valid @RequestBody AppointmentRequest request) {
        AppointmentResponse response = appointmentService.reserveAppointment(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @PostMapping("/appointments/{id}/confirm-payment")
    @Operation(
        summary = "Confirm Appointment Payment",
        description = "Finalizes the booking by confirming payment for a temporarily held reservation. Transitions status to CONFIRMED.",
        responses = {
            @ApiResponse(responseCode = "200", description = "Payment confirmed; appointment booked", content = @Content(schema = @Schema(implementation = AppointmentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Appointment is not in PENDING_PAYMENT status"),
            @ApiResponse(responseCode = "404", description = "Reservation not found"),
            @ApiResponse(responseCode = "409", description = "Reservation has expired and was auto-deleted")
        }
    )
    public ResponseEntity<AppointmentResponse> confirmAppointmentPayment(
            @Parameter(description = "ID of the temporary appointment reservation") @PathVariable UUID id) {
        AppointmentResponse response = appointmentService.confirmAppointmentPayment(id);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/appointments/{id}/release")
    @Operation(
        summary = "Release a Reservation",
        description = "Manually cancels and deletes a PENDING_PAYMENT reservation, returning the slot immediately to availability.",
        responses = {
            @ApiResponse(responseCode = "204", description = "Reservation successfully released"),
            @ApiResponse(responseCode = "400", description = "Appointment is not in PENDING_PAYMENT status")
        }
    )
    public ResponseEntity<Void> releaseAppointmentReservation(
            @Parameter(description = "ID of the appointment reservation to release") @PathVariable UUID id) {
        appointmentService.releaseAppointmentReservation(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/appointments/{id}/complete")
    @Operation(
        summary = "Complete an Appointment (Authenticated)",
        description = "Marks a confirmed appointment as COMPLETED. Can be invoked by the system or doctors/admins.",
        security = @SecurityRequirement(name = "Bearer Authentication"),
        responses = {
            @ApiResponse(responseCode = "204", description = "Appointment marked as completed"),
            @ApiResponse(responseCode = "400", description = "Only CONFIRMED appointments can be marked as COMPLETED"),
            @ApiResponse(responseCode = "404", description = "Appointment not found")
        }
    )
    public ResponseEntity<Void> completeAppointment(
            @Parameter(description = "ID of the confirmed appointment") @PathVariable UUID id) {
        appointmentService.completeAppointment(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/appointments/{id}")
    @Operation(
        summary = "Cancel an Appointment",
        description = "Cancels a confirmed appointment. The cancellation is idempotent.",
        responses = {
            @ApiResponse(responseCode = "204", description = "Appointment successfully cancelled"),
            @ApiResponse(responseCode = "404", description = "Appointment not found")
        }
    )
    public ResponseEntity<Void> cancelAppointment(
            @Parameter(description = "ID of the appointment to cancel") @PathVariable UUID id) {
        appointmentService.cancelAppointment(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/appointments")
    @Operation(
        summary = "Get Paginated Appointments (Authenticated)",
        description = "Retrieves a paginated list of appointments. Admins see all appointments within their organization, while Doctors see only their own appointments.",
        security = @SecurityRequirement(name = "Bearer Authentication"),
        responses = {
            @ApiResponse(responseCode = "200", description = "Appointments page retrieved successfully"),
            @ApiResponse(responseCode = "401", description = "User is not authenticated")
        }
    )
    public ResponseEntity<Page<AppointmentResponse>> getAppointments(@PageableDefault(size = 20) Pageable pageable) {
        Page<AppointmentResponse> response = appointmentService.getAppointments(pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/events")
    @Operation(
        summary = "Get Audit Processed Events (Admin only)",
        description = "Retrieves a paginated history of event notifications successfully processed by the backend for the Admin's organization.",
        security = @SecurityRequirement(name = "Bearer Authentication"),
        responses = {
            @ApiResponse(responseCode = "200", description = "Event logs retrieved successfully"),
            @ApiResponse(responseCode = "401", description = "User is not authenticated"),
            @ApiResponse(responseCode = "403", description = "Only administrators can view event logs")
        }
    )
    public ResponseEntity<Page<ProcessedEvent>> getProcessedEvents(@PageableDefault(size = 20) Pageable pageable) {
        Page<ProcessedEvent> response = appointmentService.getProcessedEvents(pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/logs")
    @PreAuthorize("hasRole('" + UserRole.ADMIN + "')")
    @Operation(
        summary = "Get Business Audit Trail (Admin only)",
        description = "Retrieves a detailed audit log of appointment state transitions (e.g. from PENDING_PAYMENT to CONFIRMED).",
        security = @SecurityRequirement(name = "Bearer Authentication"),
        responses = {
            @ApiResponse(responseCode = "200", description = "Audit trail logs retrieved successfully"),
            @ApiResponse(responseCode = "403", description = "Requires Admin permissions")
        }
    )
    public ResponseEntity<Page<AppointmentLogResponse>> getAppointmentLogs(@PageableDefault(size = 20) Pageable pageable) {
        Page<AppointmentLogResponse> response = appointmentService.getAppointmentLogs(pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/events/dlq")
    @PreAuthorize("hasRole('" + UserRole.ADMIN + "')")
    @Operation(
        summary = "Peek at Dead Letter Queue (DLQ) messages (Admin only)",
        description = "Inspects the RabbitMQ DLQ queue messages without consuming or removing them.",
        security = @SecurityRequirement(name = "Bearer Authentication"),
        responses = {
            @ApiResponse(responseCode = "200", description = "DLQ messages successfully peeked", content = @Content(array = @ArraySchema(schema = @Schema(implementation = DlqMessageResponse.class)))),
            @ApiResponse(responseCode = "403", description = "Requires Admin permissions")
        }
    )
    public ResponseEntity<List<DlqMessageResponse>> getDlqMessages(
            @Parameter(description = "Maximum number of messages to inspect") @RequestParam(defaultValue = "50") int count) {
        List<DlqMessageResponse> messages = dlqService.peekDlqMessages(count);
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/events/dlq/count")
    @PreAuthorize("hasRole('" + UserRole.ADMIN + "')")
    @Operation(
        summary = "Get DLQ message count (Admin only)",
        description = "Returns the count of messages currently sitting in the Dead Letter Queue.",
        security = @SecurityRequirement(name = "Bearer Authentication"),
        responses = {
            @ApiResponse(responseCode = "200", description = "Message count retrieved successfully"),
            @ApiResponse(responseCode = "403", description = "Requires Admin permissions")
        }
    )
    public ResponseEntity<java.util.Map<String, Long>> getDlqCount() {
        long count = dlqService.getDlqMessageCount();
        return ResponseEntity.ok(java.util.Map.of("count", count));
    }

    @PostMapping("/events/dlq/reprocess")
    @PreAuthorize("hasRole('" + UserRole.ADMIN + "')")
    @Operation(
        summary = "Reprocess message(s) from DLQ (Admin only)",
        description = "Republishes a failed event (by eventId) back to the main exchange, or reprocesses all messages in the DLQ if no ID is specified.",
        security = @SecurityRequirement(name = "Bearer Authentication"),
        responses = {
            @ApiResponse(responseCode = "200", description = "Messages reprocessed successfully"),
            @ApiResponse(responseCode = "403", description = "Requires Admin permissions"),
            @ApiResponse(responseCode = "404", description = "Specific message ID not found in the DLQ")
        }
    )
    public ResponseEntity<Void> reprocessDlqMessages(
            @Parameter(description = "Optional eventId of a specific message to reprocess") @RequestParam(required = false) String eventId) {
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

    @PostMapping("/events/dlq/dismiss")
    @PreAuthorize("hasRole('" + UserRole.ADMIN + "')")
    @Operation(
        summary = "Dismiss/Purge message(s) from DLQ (Admin only)",
        description = "Discards a specific message from the DLQ by eventId, or purges all DLQ messages if no ID is specified.",
        security = @SecurityRequirement(name = "Bearer Authentication"),
        responses = {
            @ApiResponse(responseCode = "200", description = "Messages dismissed successfully"),
            @ApiResponse(responseCode = "403", description = "Requires Admin permissions"),
            @ApiResponse(responseCode = "404", description = "Specific message ID not found in the DLQ")
        }
    )
    public ResponseEntity<Void> dismissDlqMessages(
            @Parameter(description = "Optional eventId of a specific message to dismiss") @RequestParam(required = false) String eventId) {
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
    @Operation(
        summary = "Get Doctor Available Slots",
        description = "Retrieves all 30-minute time slots for a doctor on a specific date, indicating whether they are AVAILABLE, PAST, or already booked.",
        responses = {
            @ApiResponse(responseCode = "200", description = "Available slots retrieved successfully", content = @Content(array = @ArraySchema(schema = @Schema(implementation = SlotResponse.class)))),
            @ApiResponse(responseCode = "400", description = "User is not a doctor"),
            @ApiResponse(responseCode = "404", description = "Doctor not found")
        }
    )
    public ResponseEntity<List<SlotResponse>> getAvailableSlots(
            @Parameter(description = "ID of the doctor") @RequestParam UUID doctorId,
            @Parameter(description = "Date in ISO-8601 format (YYYY-MM-DD)") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        List<SlotResponse> response = appointmentService.getAvailableSlots(doctorId, date);
        return ResponseEntity.ok(response);
    }
}
