package com.healthapp.appointment.event;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DoctorProvisionedPayload {
    private UUID doctorId;
    private String doctorEmail;
    private String firstName;
    private String lastName;
    private String department;
    private String degrees;
    private UUID orgId;
    private String orgName;
    private String orgSlug;
    private String provisionedBy;
}
