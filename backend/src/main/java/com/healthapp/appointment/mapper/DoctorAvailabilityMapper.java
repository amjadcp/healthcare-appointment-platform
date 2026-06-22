package com.healthapp.appointment.mapper;

import com.healthapp.appointment.dto.response.DoctorAvailabilityResponse;
import com.healthapp.appointment.model.DoctorAvailability;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class DoctorAvailabilityMapper {

    public DoctorAvailabilityResponse toResponse(DoctorAvailability availability) {
        if (availability == null) {
            return null;
        }
        return new DoctorAvailabilityResponse(
            availability.getId(),
            availability.getDoctor().getId(),
            availability.getDayOfWeek(),
            availability.getStartTime(),
            availability.getEndTime()
        );
    }

    public List<DoctorAvailabilityResponse> toResponseList(List<DoctorAvailability> availabilities) {
        if (availabilities == null) {
            return List.of();
        }
        return availabilities.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }
}
