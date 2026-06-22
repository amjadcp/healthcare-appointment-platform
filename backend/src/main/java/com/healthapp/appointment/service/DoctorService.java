package com.healthapp.appointment.service;

import com.healthapp.appointment.dto.request.AvailabilityUpdateRequest;
import com.healthapp.appointment.dto.request.DoctorProvisionRequest;
import com.healthapp.appointment.dto.response.DoctorAvailabilityResponse;
import com.healthapp.appointment.dto.response.UserResponse;

import java.util.List;
import java.util.UUID;

public interface DoctorService {
    UserResponse provisionDoctor(DoctorProvisionRequest request);
    List<DoctorAvailabilityResponse> updateAvailability(UUID doctorId, List<AvailabilityUpdateRequest> request);
    List<UserResponse> getAllDoctors();
    List<DoctorAvailabilityResponse> getDoctorAvailability(UUID doctorId);
}
