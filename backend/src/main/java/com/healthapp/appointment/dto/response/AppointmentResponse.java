package com.healthapp.appointment.dto.response;

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
public class AppointmentResponse {
    private UUID id;
    private String patientName;
    private String patientEmail;
    private String patientPhone;
    private UUID doctorId;
    private String doctorName;
    private OffsetDateTime slotStartTime;
    private OffsetDateTime slotEndTime;
    private String status;
    private String paymentMethod;
    private Long version;
}
