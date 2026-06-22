package com.healthapp.appointment.mapper;

import com.healthapp.appointment.dto.response.AuthResponse;
import com.healthapp.appointment.dto.response.UserResponse;
import com.healthapp.appointment.model.User;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    public UserResponse toUserResponse(User user) {
        if (user == null) {
            return null;
        }
        return new UserResponse(
            user.getId(),
            user.getEmail(),
            user.getRole().name(),
            user.getFirstName(),
            user.getLastName(),
            user.getDepartment(),
            user.getDegrees()
        );
    }

    public AuthResponse toAuthResponse(User user, String token) {
        if (user == null) {
            return null;
        }
        return new AuthResponse(
            token,
            user.getEmail(),
            user.getRole().name(),
            user.getFirstName(),
            user.getLastName(),
            user.getOrganization() != null ? user.getOrganization().getName() : null,
            user.getOrganization() != null ? user.getOrganization().getSlug() : null
        );
    }
}
