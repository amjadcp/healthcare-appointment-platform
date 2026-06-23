package com.healthapp.appointment.event;

import com.healthapp.appointment.model.DoctorAvailability;
import com.healthapp.appointment.model.User;
import lombok.Getter;

import java.util.List;

@Getter
public class LocalDoctorAvailabilityUpdatedEvent {
    private final User doctor;
    private final List<DoctorAvailability> updatedSchedule;
    private final String updatedBy;
    // Org context captured inside the transaction
    private final String orgId;
    private final String orgSlug;

    public LocalDoctorAvailabilityUpdatedEvent(User doctor, List<DoctorAvailability> updatedSchedule,
                                               String updatedBy, String orgId, String orgSlug) {
        this.doctor = doctor;
        this.updatedSchedule = updatedSchedule;
        this.updatedBy = updatedBy;
        this.orgId = orgId;
        this.orgSlug = orgSlug;
    }
}
