package com.healthapp.appointment.event;

import com.healthapp.appointment.model.Appointment;
import lombok.Getter;

@Getter
public class LocalAppointmentCreatedEvent {
    private final Appointment appointment;

    public LocalAppointmentCreatedEvent(Appointment appointment) {
        this.appointment = appointment;
    }
}
