package com.healthapp.appointment.event;

import com.healthapp.appointment.model.Organization;
import com.healthapp.appointment.model.User;
import lombok.Getter;

@Getter
public class LocalOrganisationRegisteredEvent {
    private final Organization organization;
    private final User admin;

    public LocalOrganisationRegisteredEvent(Organization organization, User admin) {
        this.organization = organization;
        this.admin = admin;
    }
}
