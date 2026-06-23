package com.healthapp.appointment.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "appointments")
public class Appointment extends BaseEntity {

    @Column(name = "patient_name", nullable = false)
    private String patientName;

    @Column(name = "patient_email")
    private String patientEmail;

    @Column(name = "patient_phone", nullable = false)
    private String patientPhone;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false)
    private User doctor;

    @Column(name = "slot_start_time", nullable = false)
    private OffsetDateTime slotStartTime;

    @Column(name = "slot_end_time", nullable = false)
    private OffsetDateTime slotEndTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private AppointmentStatus status = AppointmentStatus.PENDING;

    @Column(name = "payment_method", nullable = false)
    private String paymentMethod = "CASH";

    @Column(name = "reserved_until")
    private OffsetDateTime reservedUntil;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    public enum AppointmentStatus {
        PENDING,
        CONFIRMED,
        CANCELLED,
        COMPLETED,
        PENDING_PAYMENT
    }
}
