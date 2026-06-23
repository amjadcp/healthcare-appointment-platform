package com.healthapp.appointment.service.impl;

import com.healthapp.appointment.dto.request.AppointmentRequest;
import com.healthapp.appointment.dto.response.AppointmentResponse;
import com.healthapp.appointment.dto.response.SlotResponse;
import com.healthapp.appointment.exception.BadRequestException;
import com.healthapp.appointment.exception.ConflictException;
import com.healthapp.appointment.exception.ResourceNotFoundException;
import com.healthapp.appointment.exception.UnauthorizedException;
import com.healthapp.appointment.mapper.AppointmentMapper;
import com.healthapp.appointment.model.Appointment;
import com.healthapp.appointment.model.AppointmentLog;
import com.healthapp.appointment.model.DoctorAvailability;
import com.healthapp.appointment.model.Organization;
import com.healthapp.appointment.model.ProcessedEvent;
import com.healthapp.appointment.model.User;
import com.healthapp.appointment.repository.AppointmentLogRepository;
import com.healthapp.appointment.repository.AppointmentRepository;
import com.healthapp.appointment.repository.DoctorAvailabilityRepository;
import com.healthapp.appointment.repository.ProcessedEventRepository;
import com.healthapp.appointment.repository.UserRepository;
import com.healthapp.appointment.event.LocalAppointmentCancelledEvent;
import com.healthapp.appointment.event.LocalAppointmentCompletedEvent;
import com.healthapp.appointment.event.LocalAppointmentCreatedEvent;
import com.healthapp.appointment.event.LocalReservationReleasedEvent;
import com.healthapp.appointment.service.AppointmentService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AppointmentServiceImpl implements AppointmentService {

    private final UserRepository userRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final AppointmentRepository appointmentRepository;
    private final AppointmentLogRepository logRepository;
    private final AppointmentMapper appointmentMapper;
    private final ApplicationEventPublisher eventPublisher;
    private final ProcessedEventRepository processedEventRepository;

    public AppointmentServiceImpl(
            UserRepository userRepository,
            DoctorAvailabilityRepository availabilityRepository,
            AppointmentRepository appointmentRepository,
            AppointmentLogRepository logRepository,
            AppointmentMapper appointmentMapper,
            ApplicationEventPublisher eventPublisher,
            ProcessedEventRepository processedEventRepository) {
        this.userRepository = userRepository;
        this.availabilityRepository = availabilityRepository;
        this.appointmentRepository = appointmentRepository;
        this.logRepository = logRepository;
        this.appointmentMapper = appointmentMapper;
        this.eventPublisher = eventPublisher;
        this.processedEventRepository = processedEventRepository;
    }

    @Override
    @Transactional
    public AppointmentResponse bookAppointment(AppointmentRequest request) {
        User doctor = userRepository.findById(request.getDoctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));

        if (doctor.getRole() != User.Role.DOCTOR) {
            throw new BadRequestException("User is not a doctor");
        }

        AppointmentResponse reservation = reserveAppointment(request);
        return confirmAppointmentPayment(reservation.getId());
    }

    @Override
    @Transactional
    public AppointmentResponse reserveAppointment(AppointmentRequest request) {
        // Clean up expired reservations first
        appointmentRepository.deleteExpiredReservations(OffsetDateTime.now(ZoneOffset.UTC));

        User doctor = userRepository.findById(request.getDoctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));

        if (doctor.getRole() != User.Role.DOCTOR) {
            throw new BadRequestException("User is not a doctor");
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (request.getSlotStartTime().isBefore(now)) {
            throw new BadRequestException("Cannot book a slot in the past");
        }

        // Align on 30-minute boundary
        int minute = request.getSlotStartTime().getMinute();
        int second = request.getSlotStartTime().getSecond();
        int nano = request.getSlotStartTime().getNano();
        if ((minute != 0 && minute != 30) || second != 0 || nano != 0) {
            throw new BadRequestException("Slot start time must be aligned on 30-minute boundaries");
        }

        // Validate that requested slot is in the list of available slots
        List<SlotResponse> availableSlots = getAvailableSlots(request.getDoctorId(), request.getSlotStartTime().toLocalDate());
        SlotResponse requestedSlot = availableSlots.stream()
                .filter(slot -> slot.getSlotStartTime().toInstant().equals(request.getSlotStartTime().toInstant()))
                .findFirst()
                .orElse(null);

        if (requestedSlot == null) {
            throw new BadRequestException("Doctor has no availability scheduled on this day/time");
        }

        if (!requestedSlot.isAvailable()) {
            if ("PENDING_PAYMENT".equals(requestedSlot.getStatus())) {
                throw new ConflictException("The selected slot is temporarily held for payment. Please choose another slot or try again later.");
            }
            throw new ConflictException("The selected slot is already booked. Please choose another slot.");
        }

        Appointment appointment = new Appointment();
        appointment.setPatientName(request.getPatientName());
        appointment.setPatientEmail(request.getPatientEmail());
        appointment.setPatientPhone(request.getPatientPhone());
        appointment.setDoctor(doctor);
        appointment.setSlotStartTime(request.getSlotStartTime());
        appointment.setSlotEndTime(request.getSlotStartTime().plusMinutes(30));
        appointment.setStatus(Appointment.AppointmentStatus.PENDING_PAYMENT);
        appointment.setReservedUntil(OffsetDateTime.now(ZoneOffset.UTC).plusSeconds(30));

        Appointment savedAppointment = appointmentRepository.save(appointment);

        // Audit Log
        AppointmentLog log = new AppointmentLog();
        log.setAppointment(savedAppointment);
        log.setFromStatus(null);
        log.setToStatus(Appointment.AppointmentStatus.PENDING_PAYMENT);
        log.setChangedBy("PATIENT");
        logRepository.save(log);

        return appointmentMapper.toResponse(savedAppointment);
    }

    @Override
    @Transactional
    public AppointmentResponse confirmAppointmentPayment(UUID appointmentId) {
        // Clean up expired reservations first
        appointmentRepository.deleteExpiredReservations(OffsetDateTime.now(ZoneOffset.UTC));

        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found"));

        if (appointment.getStatus() != Appointment.AppointmentStatus.PENDING_PAYMENT) {
            throw new BadRequestException("This appointment is not in PENDING_PAYMENT status");
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (appointment.getReservedUntil() != null && appointment.getReservedUntil().isBefore(now)) {
            appointmentRepository.delete(appointment);
            throw new ConflictException("Your reservation has expired. Please try booking the slot again.");
        }

        Appointment.AppointmentStatus previousStatus = appointment.getStatus();
        appointment.setStatus(Appointment.AppointmentStatus.CONFIRMED);
        appointment.setReservedUntil(null);
        Appointment savedAppointment = appointmentRepository.save(appointment);

        // Audit Log
        AppointmentLog log = new AppointmentLog();
        log.setAppointment(savedAppointment);
        log.setFromStatus(previousStatus);
        log.setToStatus(Appointment.AppointmentStatus.CONFIRMED);
        log.setChangedBy("PATIENT");
        logRepository.save(log);

        // Publish local transaction-aware event (capture org context inside transaction)
        User doctor2 = savedAppointment.getDoctor();
        Organization org2 = doctor2.getOrganization();
        eventPublisher.publishEvent(new LocalAppointmentCreatedEvent(
                savedAppointment,
                org2 != null ? org2.getId().toString() : null,
                org2 != null ? org2.getName() : null,
                org2 != null ? org2.getSlug() : null,
                doctor2.getFirstName() + " " + doctor2.getLastName()
        ));

        return appointmentMapper.toResponse(savedAppointment);
    }

    @Override
    @Transactional
    public void releaseAppointmentReservation(UUID appointmentId) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElse(null);

        if (appointment != null && appointment.getStatus() == Appointment.AppointmentStatus.PENDING_PAYMENT) {
            OffsetDateTime reservedAt = appointment.getReservedUntil() != null
                    ? appointment.getReservedUntil().minusSeconds(30)
                    : OffsetDateTime.now(ZoneOffset.UTC);
            // Capture org context before deleting
            User relDoctor = appointment.getDoctor();
            Organization relOrg = relDoctor != null ? relDoctor.getOrganization() : null;
            String relOrgId   = relOrg != null ? relOrg.getId().toString() : null;
            String relOrgSlug = relOrg != null ? relOrg.getSlug() : null;

            appointmentRepository.delete(appointment);
            appointmentRepository.flush();
            eventPublisher.publishEvent(new LocalReservationReleasedEvent(
                    appointment, reservedAt, "USER_CANCELLED", relOrgId, relOrgSlug));
        }
    }

    @Override
    @Transactional
    public void completeAppointment(UUID appointmentId) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));

        if (appointment.getStatus() != Appointment.AppointmentStatus.CONFIRMED) {
            throw new BadRequestException("Only CONFIRMED appointments can be marked as COMPLETED");
        }

        Appointment.AppointmentStatus previousStatus = appointment.getStatus();
        appointment.setStatus(Appointment.AppointmentStatus.COMPLETED);
        appointmentRepository.save(appointment);

        String completedBy = "SYSTEM";
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            completedBy = auth.getName();
        }

        // Audit Log
        AppointmentLog log = new AppointmentLog();
        log.setAppointment(appointment);
        log.setFromStatus(previousStatus);
        log.setToStatus(Appointment.AppointmentStatus.COMPLETED);
        log.setChangedBy(completedBy);
        logRepository.save(log);

        // Publish local transaction-aware event
        User cmpDoctor = appointment.getDoctor();
        Organization cmpOrg = cmpDoctor != null ? cmpDoctor.getOrganization() : null;
        eventPublisher.publishEvent(new LocalAppointmentCompletedEvent(
                appointment, completedBy,
                cmpOrg != null ? cmpOrg.getName() : null,
                cmpOrg != null ? cmpOrg.getSlug() : null,
                cmpDoctor != null ? cmpDoctor.getFirstName() + " " + cmpDoctor.getLastName() : null
        ));
    }

    @Override
    @Transactional
    public void cancelAppointment(UUID appointmentId) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));

        if (appointment.getStatus() == Appointment.AppointmentStatus.CANCELLED) {
            return; // Idempotent cancellation
        }

        Appointment.AppointmentStatus previousStatus = appointment.getStatus();
        appointment.setStatus(Appointment.AppointmentStatus.CANCELLED);
        appointmentRepository.save(appointment);

        // Find modifier name
        String cancelledBy = "PATIENT";
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            cancelledBy = auth.getName();
        }

        // Audit Log
        AppointmentLog log = new AppointmentLog();
        log.setAppointment(appointment);
        log.setFromStatus(previousStatus);
        log.setToStatus(Appointment.AppointmentStatus.CANCELLED);
        log.setChangedBy(cancelledBy);
        logRepository.save(log);

        // Publish local transaction-aware event
        User canDoctor = appointment.getDoctor();
        Organization canOrg = canDoctor != null ? canDoctor.getOrganization() : null;
        eventPublisher.publishEvent(new LocalAppointmentCancelledEvent(
                appointment, cancelledBy, "User requested cancellation",
                canOrg != null ? canOrg.getName() : null,
                canOrg != null ? canOrg.getSlug() : null,
                canDoctor != null ? canDoctor.getFirstName() + " " + canDoctor.getLastName() : null
        ));
    }

    @Override
    @Transactional
    public List<SlotResponse> getAvailableSlots(UUID doctorId, LocalDate date) {
        // Clean up expired reservations first
        appointmentRepository.deleteExpiredReservations(OffsetDateTime.now(ZoneOffset.UTC));

        User doctor = userRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));

        if (doctor.getRole() != User.Role.DOCTOR) {
            throw new BadRequestException("User is not a doctor");
        }

        DayOfWeek day = date.getDayOfWeek();
        DoctorAvailability availability = availabilityRepository
                .findByDoctorIdAndDayOfWeek(doctorId, day)
                .orElse(null);

        if (availability == null) {
            return new ArrayList<>(); // Doctor has explicitly disabled availability for this day
        }

        LocalTime start = availability.getStartTime();
        LocalTime end = availability.getEndTime();

        List<OffsetDateTime> allSlots = new ArrayList<>();
        LocalTime current = start;
        while (current.plusMinutes(30).isBefore(end) || current.plusMinutes(30).equals(end)) {
            allSlots.add(OffsetDateTime.of(date, current, ZoneOffset.UTC));
            current = current.plusMinutes(30);
        }

        OffsetDateTime startOfDay = date.atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime endOfDay = date.atTime(LocalTime.MAX).atOffset(ZoneOffset.UTC);

        List<Appointment> bookedAppointments = appointmentRepository
                .findByDoctorIdAndSlotStartTimeBetweenAndStatusNot(doctorId, startOfDay, endOfDay, Appointment.AppointmentStatus.CANCELLED);

        // Map booked slots by instant to check availability and status easily
        java.util.Map<Instant, Appointment> bookedMap = bookedAppointments.stream()
                .collect(Collectors.toMap(
                        appt -> appt.getSlotStartTime().toInstant(),
                        appt -> appt,
                        (existing, replacement) -> existing
                ));

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        return allSlots.stream()
                .map(slot -> {
                    Appointment booked = bookedMap.get(slot.toInstant());
                    boolean available = true;
                    String status = "AVAILABLE";

                    if (slot.isBefore(now)) {
                        available = false;
                        status = "PAST";
                    } else if (booked != null) {
                        available = false;
                        status = booked.getStatus().name();
                    }

                    return new SlotResponse(slot, available, status);
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AppointmentResponse> getAppointments(Pageable pageable) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new UnauthorizedException("User is not authenticated");
        }

        String email = auth.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("Authenticated user not found"));

        Page<Appointment> page;
        if (user.getRole() == User.Role.ADMIN) {
            page = appointmentRepository.findByDoctorOrganizationId(user.getOrganization().getId(), pageable);
        } else {
            page = appointmentRepository.findByDoctorId(user.getId(), pageable);
        }

        return page.map(appointmentMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ProcessedEvent> getProcessedEvents(Pageable pageable) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new UnauthorizedException("User is not authenticated");
        }

        String email = auth.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("Authenticated user not found"));

        if (user.getRole() != User.Role.ADMIN) {
            throw new UnauthorizedException("Only administrators can view event logs");
        }

        String orgSlug = user.getOrganization().getSlug();
        return processedEventRepository.findByOrgSlugOrderByProcessedAtDesc(orgSlug, pageable);
    }
}
