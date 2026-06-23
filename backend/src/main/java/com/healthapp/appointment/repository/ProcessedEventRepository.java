package com.healthapp.appointment.repository;

import com.healthapp.appointment.model.ProcessedEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ProcessedEventRepository extends JpaRepository<ProcessedEvent, UUID> {
    Page<ProcessedEvent> findByOrgSlugOrderByProcessedAtDesc(String orgSlug, Pageable pageable);
}
