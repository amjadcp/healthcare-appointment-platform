package com.healthapp.appointment.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AppointmentRequest {

    @NotBlank(message = "Patient name is required")
    private String patientName;

    @NotBlank(message = "Patient email is required")
    @Email(message = "Invalid email format")
    private String patientEmail;

    @NotBlank(message = "Patient phone is required")
    private String patientPhone;

    @NotNull(message = "Doctor ID is required")
    private UUID doctorId;

    @NotNull(message = "Slot start time is required")
    private OffsetDateTime slotStartTime;
}
