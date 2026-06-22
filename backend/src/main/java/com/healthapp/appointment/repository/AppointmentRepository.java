package com.healthapp.appointment.repository;

import com.healthapp.appointment.model.Appointment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {
    List<Appointment> findByDoctorIdAndSlotStartTimeBetweenAndStatusNot(
        UUID doctorId, OffsetDateTime start, OffsetDateTime end, Appointment.AppointmentStatus status
    );

    boolean existsByDoctorIdAndSlotStartTimeAndStatusNot(
        UUID doctorId, OffsetDateTime slotStartTime, Appointment.AppointmentStatus status
    );

    Page<Appointment> findByDoctorId(UUID doctorId, Pageable pageable);
    
    Page<Appointment> findByDoctorIdAndStatusNot(UUID doctorId, Appointment.AppointmentStatus status, Pageable pageable);

    Page<Appointment> findByDoctorOrganizationId(UUID organizationId, Pageable pageable);
}
