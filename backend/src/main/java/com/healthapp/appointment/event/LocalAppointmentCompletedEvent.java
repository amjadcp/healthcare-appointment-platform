package com.healthapp.appointment.event;

import com.healthapp.appointment.model.Appointment;
import lombok.Getter;

@Getter
public class LocalAppointmentCompletedEvent {
    private final Appointment appointment;
    private final String completedBy;
    // Org/doctor context captured inside the transaction
    private final String orgName;
    private final String orgSlug;
    private final String doctorName;

    public LocalAppointmentCompletedEvent(Appointment appointment, String completedBy,
                                          String orgName, String orgSlug, String doctorName) {
        this.appointment = appointment;
        this.completedBy = completedBy;
        this.orgName = orgName;
        this.orgSlug = orgSlug;
        this.doctorName = doctorName;
    }
}
