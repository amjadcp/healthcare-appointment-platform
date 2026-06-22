package com.healthapp.appointment.service.impl;

import com.healthapp.appointment.dto.request.AvailabilityUpdateRequest;
import com.healthapp.appointment.dto.request.DoctorProvisionRequest;
import com.healthapp.appointment.dto.response.DoctorAvailabilityResponse;
import com.healthapp.appointment.dto.response.UserResponse;
import com.healthapp.appointment.exception.BadRequestException;
import com.healthapp.appointment.exception.ConflictException;
import com.healthapp.appointment.exception.ResourceNotFoundException;
import com.healthapp.appointment.mapper.DoctorAvailabilityMapper;
import com.healthapp.appointment.mapper.UserMapper;
import com.healthapp.appointment.model.DoctorAvailability;
import com.healthapp.appointment.model.User;
import com.healthapp.appointment.repository.DoctorAvailabilityRepository;
import com.healthapp.appointment.repository.UserRepository;
import com.healthapp.appointment.service.DoctorService;
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
public class DoctorServiceImpl implements DoctorService {

    private final UserRepository userRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper userMapper;
    private final DoctorAvailabilityMapper availabilityMapper;

    public DoctorServiceImpl(
            UserRepository userRepository,
            DoctorAvailabilityRepository availabilityRepository,
            PasswordEncoder passwordEncoder,
            UserMapper userMapper,
            DoctorAvailabilityMapper availabilityMapper) {
        this.userRepository = userRepository;
        this.availabilityRepository = availabilityRepository;
        this.passwordEncoder = passwordEncoder;
        this.userMapper = userMapper;
        this.availabilityMapper = availabilityMapper;
    }

    @Override
    @Transactional
    public UserResponse provisionDoctor(DoctorProvisionRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new ConflictException("Email is already in use");
        }

        User doctor = new User();
        doctor.setEmail(request.getEmail());
        doctor.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        doctor.setRole(User.Role.DOCTOR);
        doctor.setFirstName(request.getFirstName());
        doctor.setLastName(request.getLastName());
        doctor.setDepartment(request.getDepartment());
        doctor.setDegrees(request.getDegrees());

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
        return availabilityMapper.toResponseList(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserResponse> getAllDoctors() {
        return userRepository.findByRole(User.Role.DOCTOR).stream()
                .map(userMapper::toUserResponse)
                .collect(Collectors.toList());
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
}
