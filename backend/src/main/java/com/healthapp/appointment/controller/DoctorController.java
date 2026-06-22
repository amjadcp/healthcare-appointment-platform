package com.healthapp.appointment.controller;

import com.healthapp.appointment.dto.request.AvailabilityUpdateRequest;
import com.healthapp.appointment.dto.request.DoctorProvisionRequest;
import com.healthapp.appointment.dto.response.DoctorAvailabilityResponse;
import com.healthapp.appointment.dto.response.UserResponse;
import com.healthapp.appointment.security.UserRole;
import com.healthapp.appointment.service.DoctorService;
import jakarta.validation.Valid;
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
public class DoctorController {

    private final DoctorService doctorService;

    public DoctorController(DoctorService doctorService) {
        this.doctorService = doctorService;
    }

    @PostMapping
    @PreAuthorize("hasRole('" + UserRole.ADMIN + "')")
    public ResponseEntity<UserResponse> provisionDoctor(@Valid @RequestBody DoctorProvisionRequest request) {
        UserResponse response = doctorService.provisionDoctor(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @PutMapping("/{id}/availability")
    @PreAuthorize("hasRole('" + UserRole.ADMIN + "')")
    public ResponseEntity<List<DoctorAvailabilityResponse>> updateAvailability(
            @PathVariable UUID id,
            @Valid @RequestBody List<AvailabilityUpdateRequest> request) {
        List<DoctorAvailabilityResponse> response = doctorService.updateAvailability(id, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<UserResponse>> getAllDoctors(@RequestParam(required = false) String orgSlug) {
        List<UserResponse> response = doctorService.getAllDoctors(orgSlug);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/availability")
    public ResponseEntity<List<DoctorAvailabilityResponse>> getDoctorAvailability(@PathVariable UUID id) {
        List<DoctorAvailabilityResponse> response = doctorService.getDoctorAvailability(id);
        return ResponseEntity.ok(response);
    }
}
