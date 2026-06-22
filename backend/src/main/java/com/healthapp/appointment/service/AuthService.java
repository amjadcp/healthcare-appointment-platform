package com.healthapp.appointment.service;

import com.healthapp.appointment.dto.request.LoginRequest;
import com.healthapp.appointment.dto.request.RegisterRequest;
import com.healthapp.appointment.dto.response.AuthResponse;

public interface AuthService {
    AuthResponse registerAdmin(RegisterRequest request);
    AuthResponse login(LoginRequest request);
}
