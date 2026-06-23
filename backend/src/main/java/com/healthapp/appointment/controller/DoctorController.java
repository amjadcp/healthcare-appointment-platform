package com.healthapp.appointment.controller;

import com.healthapp.appointment.dto.request.AvailabilityUpdateRequest;
import com.healthapp.appointment.dto.request.DoctorProvisionRequest;
import com.healthapp.appointment.dto.response.DoctorAvailabilityResponse;
import com.healthapp.appointment.dto.response.UserResponse;
import com.healthapp.appointment.security.UserRole;
import com.healthapp.appointment.service.DoctorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/doctors")
@RequiredArgsConstructor
@Tag(name = "Doctor Management", description = "Endpoints for doctor provisioning and availability management")
public class DoctorController {

    private final DoctorService doctorService;

    @PostMapping
    @PreAuthorize("hasRole('" + UserRole.ADMIN + "')")
    @Operation(
        summary = "Provision a new Doctor (Admin only)",
        description = "Registers a new doctor user associated with the authenticated admin's organization. Automatically provisions a default 9 AM to 5 PM weekly availability schedule.",
        security = @SecurityRequirement(name = "Bearer Authentication"),
        responses = {
            @ApiResponse(responseCode = "201", description = "Doctor successfully provisioned", content = @Content(schema = @Schema(implementation = UserResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid request or malformed payload"),
            @ApiResponse(responseCode = "401", description = "User is not authenticated or not found"),
            @ApiResponse(responseCode = "403", description = "Insufficient permissions (requires ADMIN role)"),
            @ApiResponse(responseCode = "409", description = "Doctor email is already in use")
        }
    )
    public ResponseEntity<UserResponse> provisionDoctor(@Valid @RequestBody DoctorProvisionRequest request) {
        UserResponse response = doctorService.provisionDoctor(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @PutMapping("/{id}/availability")
    @PreAuthorize("hasRole('" + UserRole.ADMIN + "')")
    @Operation(
        summary = "Update Doctor Availability (Admin only)",
        description = "Clears the old availability schedule for the given doctor ID and saves the new list of day-wise schedules.",
        security = @SecurityRequirement(name = "Bearer Authentication"),
        responses = {
            @ApiResponse(responseCode = "200", description = "Availability successfully updated", content = @Content(array = @ArraySchema(schema = @Schema(implementation = DoctorAvailabilityResponse.class)))),
            @ApiResponse(responseCode = "400", description = "Invalid times or malformed request"),
            @ApiResponse(responseCode = "403", description = "Access denied"),
            @ApiResponse(responseCode = "404", description = "Doctor not found")
        }
    )
    public ResponseEntity<List<DoctorAvailabilityResponse>> updateAvailability(
            @PathVariable UUID id,
            @Valid @RequestBody List<AvailabilityUpdateRequest> request) {
        List<DoctorAvailabilityResponse> response = doctorService.updateAvailability(id, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    @Operation(
        summary = "Get all Doctors",
        description = "Retrieves a list of all doctors. Can be filtered by organization slug. If orgSlug is omitted and the user is authenticated, it defaults to the user's organization.",
        responses = {
            @ApiResponse(responseCode = "200", description = "List of doctors retrieved successfully", content = @Content(array = @ArraySchema(schema = @Schema(implementation = UserResponse.class))))
        }
    )
    public ResponseEntity<List<UserResponse>> getAllDoctors(@RequestParam(required = false) String orgSlug) {
        List<UserResponse> response = doctorService.getAllDoctors(orgSlug);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/availability")
    @Operation(
        summary = "Get Doctor Availability Schedule",
        description = "Retrieves the weekly availability schedule for the specified doctor ID.",
        responses = {
            @ApiResponse(responseCode = "200", description = "Availability schedule retrieved successfully", content = @Content(array = @ArraySchema(schema = @Schema(implementation = DoctorAvailabilityResponse.class)))),
            @ApiResponse(responseCode = "400", description = "User is not a doctor"),
            @ApiResponse(responseCode = "404", description = "Doctor not found")
        }
    )
    public ResponseEntity<List<DoctorAvailabilityResponse>> getDoctorAvailability(@PathVariable UUID id) {
        List<DoctorAvailabilityResponse> response = doctorService.getDoctorAvailability(id);
        return ResponseEntity.ok(response);
    }
}
