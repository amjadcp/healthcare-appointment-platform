package com.healthapp.appointment.event;

import com.healthapp.appointment.model.User;
import lombok.Getter;

@Getter
public class LocalDoctorProvisionedEvent {
    private final User doctor;
    private final String provisionedBy;
    // Org context captured inside the transaction
    private final String orgId;
    private final String orgName;
    private final String orgSlug;

    public LocalDoctorProvisionedEvent(User doctor, String provisionedBy,
                                       String orgId, String orgName, String orgSlug) {
        this.doctor = doctor;
        this.provisionedBy = provisionedBy;
        this.orgId = orgId;
        this.orgName = orgName;
        this.orgSlug = orgSlug;
    }
}
