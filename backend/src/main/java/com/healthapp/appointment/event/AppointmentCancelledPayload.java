package com.healthapp.appointment.event;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AppointmentCancelledPayload {
    private UUID appointmentId;
    private UUID userId;
    private UUID doctorId;
    private String previousStatus;
    private String status;
    private String cancelledBy;
    private String reason;
    private String userEmail;
}
