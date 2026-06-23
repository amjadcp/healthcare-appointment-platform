package com.healthapp.appointment.event;

import com.healthapp.appointment.model.Appointment;
import lombok.Getter;

/**
 * Fired after confirmAppointmentPayment() commits.
 * All fields needed for the AMQP envelope are captured inside the transaction
 * so the publisher never needs to lazy-load associations after AFTER_COMMIT.
 */
@Getter
public class LocalAppointmentCreatedEvent {
    private final Appointment appointment;
    // Org context (captured inside transaction)
    private final String orgId;
    private final String orgName;
    private final String orgSlug;
    // Doctor display name (captured inside transaction)
    private final String doctorName;

    public LocalAppointmentCreatedEvent(Appointment appointment,
                                        String orgId, String orgName, String orgSlug,
                                        String doctorName) {
        this.appointment = appointment;
        this.orgId = orgId;
        this.orgName = orgName;
        this.orgSlug = orgSlug;
        this.doctorName = doctorName;
    }
}
