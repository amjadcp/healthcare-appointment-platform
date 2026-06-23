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
public class ReservationReleasedPayload {
    private UUID appointmentId;
    private UUID doctorId;
    private UUID orgId;
    private String orgSlug;
    private OffsetDateTime slotStartTime;
    private OffsetDateTime reservedAt;
    private OffsetDateTime releasedAt;
    private String reason; // "EXPIRED" or "USER_CANCELLED"
}
