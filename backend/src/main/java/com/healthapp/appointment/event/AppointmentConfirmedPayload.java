package com.healthapp.appointment.event;

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
public class AppointmentConfirmedPayload {
    private UUID appointmentId;
    private String patientName;
    private String patientEmail;  // nullable
    private String patientPhone;
    private UUID doctorId;
    private String doctorName;
    private UUID orgId;
    private String orgName;
    private String orgSlug;
    private OffsetDateTime slotStartTime;
    private OffsetDateTime slotEndTime;
    private String paymentMethod;
    private String status;
}
