package com.healthapp.appointment.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class AppointmentLogResponse {
    private UUID id;
    private UUID appointmentId;
    private String patientName;
    private String fromStatus;
    private String toStatus;
    private String changedBy;
    private OffsetDateTime changedAt;
}
