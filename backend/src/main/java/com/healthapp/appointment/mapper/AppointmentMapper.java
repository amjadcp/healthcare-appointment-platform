package com.healthapp.appointment.mapper;

import com.healthapp.appointment.dto.response.AppointmentResponse;
import com.healthapp.appointment.model.Appointment;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class AppointmentMapper {

    public AppointmentResponse toResponse(Appointment appointment) {
        if (appointment == null) {
            return null;
        }
        String doctorName = "";
        if (appointment.getDoctor() != null) {
            doctorName = "Dr. " + appointment.getDoctor().getFirstName() + " " + appointment.getDoctor().getLastName();
        }
        return new AppointmentResponse(
            appointment.getId(),
            appointment.getPatientName(),
            appointment.getPatientEmail(),
            appointment.getPatientPhone(),
            appointment.getDoctor() != null ? appointment.getDoctor().getId() : null,
            doctorName,
            appointment.getSlotStartTime(),
            appointment.getSlotEndTime(),
            appointment.getStatus().name(),
            appointment.getPaymentMethod(),
            appointment.getVersion()
        );
    }

    public List<AppointmentResponse> toResponseList(List<Appointment> appointments) {
        if (appointments == null) {
            return List.of();
        }
        return appointments.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }
}
