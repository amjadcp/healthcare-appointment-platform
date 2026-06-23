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
public class DoctorAvailabilityUpdatedPayload {
    private UUID doctorId;
    private String doctorName;
    private UUID orgId;
    private String orgSlug;
    private String updatedBy;
    /** Each entry: {dayOfWeek, startTime, endTime, enabled} */
    private List<Map<String, Object>> updatedSchedule;
}
