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
public class AppointmentEvent<T> {
    private UUID eventId;
    private String eventType;
    private int schemaVersion = 1;
    private OffsetDateTime occurredAt;
    private String source = "backend";
    private T payload;
}
