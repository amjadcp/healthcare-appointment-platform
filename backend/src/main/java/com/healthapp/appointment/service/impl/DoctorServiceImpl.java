package com.healthapp.appointment.service.impl;

import com.healthapp.appointment.dto.request.AvailabilityUpdateRequest;
import com.healthapp.appointment.dto.request.DoctorProvisionRequest;
import com.healthapp.appointment.dto.response.DoctorAvailabilityResponse;
import com.healthapp.appointment.dto.response.UserResponse;
import com.healthapp.appointment.event.LocalDoctorAvailabilityUpdatedEvent;
import com.healthapp.appointment.event.LocalDoctorProvisionedEvent;
import com.healthapp.appointment.exception.BadRequestException;
import com.healthapp.appointment.exception.ConflictException;
import com.healthapp.appointment.exception.ResourceNotFoundException;
import com.healthapp.appointment.exception.UnauthorizedException;
import com.healthapp.appointment.mapper.DoctorAvailabilityMapper;
import com.healthapp.appointment.mapper.UserMapper;
import com.healthapp.appointment.model.DoctorAvailability;
import com.healthapp.appointment.model.Organization;
import com.healthapp.appointment.model.User;
import com.healthapp.appointment.repository.DoctorAvailabilityRepository;
import com.healthapp.appointment.repository.UserRepository;
import com.healthapp.appointment.service.DoctorService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DoctorServiceImpl implements DoctorService {

    private final UserRepository userRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper userMapper;
    private final DoctorAvailabilityMapper availabilityMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public UserResponse provisionDoctor(DoctorProvisionRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new ConflictException("Email is already in use");
        }

        // Get authenticated Admin to find their organization
        User admin = getCurrentUserOrThrow();

        Organization org = admin.getOrganization();
        if (org == null) {
            throw new BadRequestException("Admin is not associated with any organization");
        }

        User doctor = new User();
        doctor.setEmail(request.getEmail());
        doctor.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        doctor.setRole(User.Role.DOCTOR);
        doctor.setFirstName(request.getFirstName());
        doctor.setLastName(request.getLastName());
        doctor.setDepartment(request.getDepartment());
        doctor.setDegrees(request.getDegrees());
        doctor.setOrganization(org);

        User savedDoctor = userRepository.save(doctor);

        // Provision default 9AM to 5PM availability for all days of the week
        List<DoctorAvailability> availabilities = new ArrayList<>();
        for (DayOfWeek day : DayOfWeek.values()) {
            DoctorAvailability availability = new DoctorAvailability();
            availability.setDoctor(savedDoctor);
            availability.setDayOfWeek(day);
            availability.setStartTime(LocalTime.of(9, 0));
            availability.setEndTime(LocalTime.of(17, 0));
            availabilities.add(availability);
        }
        availabilityRepository.saveAll(availabilities);

        // Publish DOCTOR_PROVISIONED event (org fields captured inside transaction)
        eventPublisher.publishEvent(new LocalDoctorProvisionedEvent(
                savedDoctor, admin.getEmail(),
                org.getId().toString(), org.getName(), org.getSlug()
        ));

        return userMapper.toUserResponse(savedDoctor);
    }

    @Override
    @Transactional
    public List<DoctorAvailabilityResponse> updateAvailability(UUID doctorId, List<AvailabilityUpdateRequest> request) {
        User doctor = userRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));

        if (doctor.getRole() != User.Role.DOCTOR) {
            throw new BadRequestException("User is not a doctor");
        }

        // Delete old availabilities
        List<DoctorAvailability> oldAvailabilities = availabilityRepository.findByDoctorId(doctorId);
        availabilityRepository.deleteAll(oldAvailabilities);
        availabilityRepository.flush(); // Force deletions to database before inserting new availabilities

        // Create new ones
        List<DoctorAvailability> newAvailabilities = request.stream().map(req -> {
            if (req.getStartTime().isAfter(req.getEndTime()) || req.getStartTime().equals(req.getEndTime())) {
                throw new BadRequestException("Start time must be before end time");
            }
            DoctorAvailability availability = new DoctorAvailability();
            availability.setDoctor(doctor);
            availability.setDayOfWeek(req.getDayOfWeek());
            availability.setStartTime(req.getStartTime());
            availability.setEndTime(req.getEndTime());
            return availability;
        }).collect(Collectors.toList());

        List<DoctorAvailability> saved = availabilityRepository.saveAll(newAvailabilities);

        // Publish DOCTOR_AVAILABILITY_UPDATED event
        String updatedBy = getAuthenticatedName("SYSTEM");
        Organization doctorOrg = doctor.getOrganization();
        eventPublisher.publishEvent(new LocalDoctorAvailabilityUpdatedEvent(
                doctor, saved, updatedBy,
                doctorOrg != null ? doctorOrg.getId().toString() : null,
                doctorOrg != null ? doctorOrg.getSlug() : null
        ));

        return availabilityMapper.toResponseList(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserResponse> getAllDoctors(String orgSlug) {
        if (orgSlug != null && !orgSlug.trim().isEmpty()) {
            return userRepository.findByRoleAndOrganizationSlug(User.Role.DOCTOR, orgSlug).stream()
                    .map(userMapper::toUserResponse)
                    .collect(Collectors.toList());
        }

        // If no orgSlug is provided, check if the current user is authenticated and filter by their organization.
        User currentUser = getCurrentUserOrNull();
        if (currentUser != null && currentUser.getOrganization() != null) {
            return userRepository.findByRoleAndOrganizationId(User.Role.DOCTOR, currentUser.getOrganization().getId()).stream()
                    .map(userMapper::toUserResponse)
                    .collect(Collectors.toList());
        }

        // Return empty list if no context (anonymous call without org slug)
        return new ArrayList<>();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DoctorAvailabilityResponse> getDoctorAvailability(UUID doctorId) {
        User doctor = userRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));
        if (doctor.getRole() != User.Role.DOCTOR) {
            throw new BadRequestException("User is not a doctor");
        }

        List<DoctorAvailability> availabilities = availabilityRepository.findByDoctorId(doctorId);
        return availabilityMapper.toResponseList(availabilities);
    }

    private User getCurrentUserOrThrow() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new UnauthorizedException("User is not authenticated");
        }
        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new UnauthorizedException("Authenticated user not found"));
    }

    private User getCurrentUserOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return userRepository.findByEmail(auth.getName()).orElse(null);
        }
        return null;
    }

    private String getAuthenticatedName(String defaultName) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return auth.getName();
        }
        return defaultName;
    }
}
