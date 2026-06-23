package com.healthapp.appointment.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SlotResponse {
    private OffsetDateTime slotStartTime;
    private boolean available;
    private String status;
}
