package com.healthapp.appointment.repository;

import com.healthapp.appointment.model.AppointmentLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.UUID;

@Repository
public interface AppointmentLogRepository extends JpaRepository<AppointmentLog, UUID> {
    List<AppointmentLog> findByAppointmentIdOrderByChangedAtDesc(UUID appointmentId);
    Page<AppointmentLog> findByAppointmentDoctorOrganizationId(UUID organizationId, Pageable pageable);
}
