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
public class AppointmentCreatedPayload {
    private UUID appointmentId;
    private UUID userId;
    private UUID doctorId;
    private OffsetDateTime slotStartTime;
    private OffsetDateTime slotEndTime;
    private String status;
    private String userEmail;
    private String userPhone;
}
