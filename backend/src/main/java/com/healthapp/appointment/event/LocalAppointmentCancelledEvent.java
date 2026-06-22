package com.healthapp.appointment.event;

import com.healthapp.appointment.model.Appointment;
import lombok.Getter;

@Getter
public class LocalAppointmentCancelledEvent {
    private final Appointment appointment;
    private final String cancelledBy;
    private final String reason;

    public LocalAppointmentCancelledEvent(Appointment appointment, String cancelledBy, String reason) {
        this.appointment = appointment;
        this.cancelledBy = cancelledBy;
        this.reason = reason;
    }
}
