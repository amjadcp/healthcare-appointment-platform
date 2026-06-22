package com.healthapp.appointment.service.impl;

import com.healthapp.appointment.dto.request.AppointmentRequest;
import com.healthapp.appointment.dto.response.AppointmentResponse;
import com.healthapp.appointment.exception.BadRequestException;
import com.healthapp.appointment.exception.ConflictException;
import com.healthapp.appointment.exception.ResourceNotFoundException;
import com.healthapp.appointment.exception.UnauthorizedException;
import com.healthapp.appointment.mapper.AppointmentMapper;
import com.healthapp.appointment.model.Appointment;
import com.healthapp.appointment.model.AppointmentLog;
import com.healthapp.appointment.model.DoctorAvailability;
import com.healthapp.appointment.model.User;
import com.healthapp.appointment.repository.AppointmentLogRepository;
import com.healthapp.appointment.repository.AppointmentRepository;
import com.healthapp.appointment.repository.DoctorAvailabilityRepository;
import com.healthapp.appointment.repository.UserRepository;
import com.healthapp.appointment.event.LocalAppointmentCancelledEvent;
import com.healthapp.appointment.event.LocalAppointmentCreatedEvent;
import com.healthapp.appointment.service.AppointmentService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
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

    public AppointmentServiceImpl(
            UserRepository userRepository,
            DoctorAvailabilityRepository availabilityRepository,
            AppointmentRepository appointmentRepository,
            AppointmentLogRepository logRepository,
            AppointmentMapper appointmentMapper,
            ApplicationEventPublisher eventPublisher) {
        this.userRepository = userRepository;
        this.availabilityRepository = availabilityRepository;
        this.appointmentRepository = appointmentRepository;
        this.logRepository = logRepository;
        this.appointmentMapper = appointmentMapper;
        this.eventPublisher = eventPublisher;
    }

    @Override
    @Transactional
    public AppointmentResponse bookAppointment(AppointmentRequest request) {
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

        // Check availability schedule
        DayOfWeek day = request.getSlotStartTime().getDayOfWeek();
        LocalTime slotTime = request.getSlotStartTime().toLocalTime();

        DoctorAvailability availability = availabilityRepository
                .findByDoctorIdAndDayOfWeek(request.getDoctorId(), day)
                .orElse(null);

        LocalTime start = availability != null ? availability.getStartTime() : LocalTime.of(9, 0);
        LocalTime end = availability != null ? availability.getEndTime() : LocalTime.of(17, 0);

        if (slotTime.isBefore(start) || slotTime.plusMinutes(30).isAfter(end)) {
            throw new BadRequestException("Slot is outside the doctor's available hours");
        }

        // Check duplicate booking
        boolean alreadyBooked = appointmentRepository.existsByDoctorIdAndSlotStartTimeAndStatusNot(
                request.getDoctorId(), request.getSlotStartTime(), Appointment.AppointmentStatus.CANCELLED
        );
        if (alreadyBooked) {
            throw new ConflictException("The selected slot is already booked");
        }

        Appointment appointment = new Appointment();
        appointment.setPatientName(request.getPatientName());
        appointment.setPatientEmail(request.getPatientEmail());
        appointment.setPatientPhone(request.getPatientPhone());
        appointment.setDoctor(doctor);
        appointment.setSlotStartTime(request.getSlotStartTime());
        appointment.setSlotEndTime(request.getSlotStartTime().plusMinutes(30));
        appointment.setStatus(Appointment.AppointmentStatus.CONFIRMED);

        Appointment savedAppointment = appointmentRepository.save(appointment);

        // Audit Log
        AppointmentLog log = new AppointmentLog();
        log.setAppointment(savedAppointment);
        log.setFromStatus(null);
        log.setToStatus(Appointment.AppointmentStatus.CONFIRMED);
        log.setChangedBy("PATIENT");
        logRepository.save(log);

        // Publish local transaction-aware event
        eventPublisher.publishEvent(new LocalAppointmentCreatedEvent(savedAppointment));

        return appointmentMapper.toResponse(savedAppointment);
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
        eventPublisher.publishEvent(new LocalAppointmentCancelledEvent(appointment, cancelledBy, "User requested cancellation"));
    }

    @Override
    @Transactional(readOnly = true)
    public List<OffsetDateTime> getAvailableSlots(UUID doctorId, LocalDate date) {
        User doctor = userRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));

        if (doctor.getRole() != User.Role.DOCTOR) {
            throw new BadRequestException("User is not a doctor");
        }

        DayOfWeek day = date.getDayOfWeek();
        DoctorAvailability availability = availabilityRepository
                .findByDoctorIdAndDayOfWeek(doctorId, day)
                .orElse(null);

        LocalTime start = availability != null ? availability.getStartTime() : LocalTime.of(9, 0);
        LocalTime end = availability != null ? availability.getEndTime() : LocalTime.of(17, 0);

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

        Set<OffsetDateTime> bookedTimes = bookedAppointments.stream()
                .map(Appointment::getSlotStartTime)
                .collect(Collectors.toSet());

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        return allSlots.stream()
                .filter(slot -> !bookedTimes.contains(slot))
                .filter(slot -> slot.isAfter(now))
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
}
