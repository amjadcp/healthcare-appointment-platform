package com.healthapp.appointment.service;

import com.healthapp.appointment.dto.request.AvailabilityUpdateRequest;
import com.healthapp.appointment.dto.request.DoctorProvisionRequest;
import com.healthapp.appointment.dto.response.DoctorAvailabilityResponse;
import com.healthapp.appointment.dto.response.UserResponse;
import com.healthapp.appointment.exception.ConflictException;
import com.healthapp.appointment.mapper.DoctorAvailabilityMapper;
import com.healthapp.appointment.mapper.UserMapper;
import com.healthapp.appointment.model.User;
import com.healthapp.appointment.repository.DoctorAvailabilityRepository;
import com.healthapp.appointment.repository.UserRepository;
import com.healthapp.appointment.service.impl.DoctorServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DoctorServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private DoctorAvailabilityRepository availabilityRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private UserMapper userMapper;

    @Mock
    private DoctorAvailabilityMapper availabilityMapper;

    @InjectMocks
    private DoctorServiceImpl doctorService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void provisionDoctor_success() {
        DoctorProvisionRequest request = new DoctorProvisionRequest();
        request.setEmail("doctor@healthapp.com");
        request.setPassword("password");
        request.setFirstName("Jane");
        request.setLastName("Smith");
        request.setDepartment("Cardiology");
        request.setDegrees("MD, FACC");

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.empty());
        when(passwordEncoder.encode(request.getPassword())).thenReturn("hashed_password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });
        when(userMapper.toUserResponse(any(User.class))).thenReturn(new UserResponse(
                UUID.randomUUID(), "doctor@healthapp.com", "DOCTOR", "Jane", "Smith", "Cardiology", "MD, FACC"
        ));

        UserResponse response = doctorService.provisionDoctor(request);

        assertNotNull(response);
        assertEquals("DOCTOR", response.getRole());
        verify(userRepository, times(1)).save(any(User.class));
        verify(availabilityRepository, times(1)).saveAll(anyList()); // Verifies default 7 availabilities are saved
    }

    @Test
    void provisionDoctor_emailExists_throwsConflictException() {
        DoctorProvisionRequest request = new DoctorProvisionRequest();
        request.setEmail("doctor@healthapp.com");

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(new User()));

        assertThrows(ConflictException.class, () -> doctorService.provisionDoctor(request));
        verify(userRepository, never()).save(any(User.class));
        verify(availabilityRepository, never()).saveAll(anyList());
    }

    @Test
    void updateAvailability_success() {
        UUID doctorId = UUID.randomUUID();
        User doctor = new User();
        doctor.setId(doctorId);
        doctor.setRole(User.Role.DOCTOR);

        AvailabilityUpdateRequest update = new AvailabilityUpdateRequest(DayOfWeek.MONDAY, LocalTime.of(10, 0), LocalTime.of(16, 0));
        List<AvailabilityUpdateRequest> requests = Collections.singletonList(update);

        when(userRepository.findById(doctorId)).thenReturn(Optional.of(doctor));
        when(availabilityRepository.findByDoctorId(doctorId)).thenReturn(Collections.emptyList());
        when(availabilityRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
        when(availabilityMapper.toResponseList(anyList())).thenReturn(Collections.singletonList(
                new DoctorAvailabilityResponse(UUID.randomUUID(), doctorId, DayOfWeek.MONDAY, LocalTime.of(10, 0), LocalTime.of(16, 0))
        ));

        List<DoctorAvailabilityResponse> result = doctorService.updateAvailability(doctorId, requests);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals(DayOfWeek.MONDAY, result.get(0).getDayOfWeek());
        verify(availabilityRepository, times(1)).deleteAll(anyList());
        verify(availabilityRepository, times(1)).saveAll(anyList());
    }
}
