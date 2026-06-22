package com.healthapp.appointment.service;

import com.healthapp.appointment.dto.request.LoginRequest;
import com.healthapp.appointment.dto.request.RegisterRequest;
import com.healthapp.appointment.dto.response.AuthResponse;
import com.healthapp.appointment.exception.ConflictException;
import com.healthapp.appointment.exception.UnauthorizedException;
import com.healthapp.appointment.mapper.UserMapper;
import com.healthapp.appointment.model.User;
import com.healthapp.appointment.repository.UserRepository;
import com.healthapp.appointment.security.JwtUtils;
import com.healthapp.appointment.service.impl.AuthServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtils jwtUtils;

    @Mock
    private UserMapper userMapper;

    @InjectMocks
    private AuthServiceImpl authService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void registerAdmin_success() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("admin@healthapp.com");
        request.setPassword("password");
        request.setFirstName("John");
        request.setLastName("Doe");

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.empty());
        when(passwordEncoder.encode(request.getPassword())).thenReturn("hashed_password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtUtils.generateToken("admin@healthapp.com")).thenReturn("jwt_token");
        when(userMapper.toAuthResponse(any(User.class), eq("jwt_token")))
                .thenReturn(new AuthResponse("jwt_token", "admin@healthapp.com", "ADMIN", "John", "Doe"));

        AuthResponse response = authService.registerAdmin(request);

        assertNotNull(response);
        assertEquals("jwt_token", response.getToken());
        assertEquals("admin@healthapp.com", response.getEmail());
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    void registerAdmin_emailExists_throwsConflictException() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("admin@healthapp.com");

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(new User()));

        assertThrows(ConflictException.class, () -> authService.registerAdmin(request));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void login_success() {
        LoginRequest request = new LoginRequest();
        request.setEmail("admin@healthapp.com");
        request.setPassword("password");

        User user = new User();
        user.setEmail("admin@healthapp.com");
        user.setPasswordHash("hashed_password");

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(request.getPassword(), "hashed_password")).thenReturn(true);
        when(jwtUtils.generateToken("admin@healthapp.com")).thenReturn("jwt_token");
        when(userMapper.toAuthResponse(user, "jwt_token"))
                .thenReturn(new AuthResponse("jwt_token", "admin@healthapp.com", "ADMIN", "John", "Doe"));

        AuthResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals("jwt_token", response.getToken());
    }

    @Test
    void login_invalidPassword_throwsUnauthorizedException() {
        LoginRequest request = new LoginRequest();
        request.setEmail("admin@healthapp.com");
        request.setPassword("wrong");

        User user = new User();
        user.setEmail("admin@healthapp.com");
        user.setPasswordHash("hashed_password");

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(request.getPassword(), "hashed_password")).thenReturn(false);

        assertThrows(UnauthorizedException.class, () -> authService.login(request));
    }
}
