package com.healthapp.appointment.event;

import com.healthapp.appointment.model.Appointment;
import lombok.Getter;

import java.time.OffsetDateTime;

@Getter
public class LocalReservationReleasedEvent {
    private final Appointment appointment;
    private final OffsetDateTime reservedAt;
    private final String reason; // "EXPIRED" or "USER_CANCELLED"
    // Org context captured inside the transaction
    private final String orgId;
    private final String orgSlug;

    public LocalReservationReleasedEvent(Appointment appointment, OffsetDateTime reservedAt,
                                         String reason, String orgId, String orgSlug) {
        this.appointment = appointment;
        this.reservedAt = reservedAt;
        this.reason = reason;
        this.orgId = orgId;
        this.orgSlug = orgSlug;
    }
}
