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
public class OrganisationRegisteredPayload {
    private UUID orgId;
    private String orgName;
    private String orgSlug;
    private UUID adminId;
    private String adminEmail;
    private String adminFirstName;
    private String adminLastName;
    private OffsetDateTime registeredAt;
}
