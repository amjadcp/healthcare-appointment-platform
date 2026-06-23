package com.healthapp.appointment.service.impl;

import com.healthapp.appointment.dto.request.LoginRequest;
import com.healthapp.appointment.dto.request.RegisterRequest;
import com.healthapp.appointment.dto.response.AuthResponse;
import com.healthapp.appointment.event.LocalOrganisationRegisteredEvent;
import com.healthapp.appointment.exception.ConflictException;
import com.healthapp.appointment.exception.UnauthorizedException;
import com.healthapp.appointment.mapper.UserMapper;
import com.healthapp.appointment.model.Organization;
import com.healthapp.appointment.model.User;
import com.healthapp.appointment.repository.OrganizationRepository;
import com.healthapp.appointment.repository.UserRepository;
import com.healthapp.appointment.security.JwtUtils;
import com.healthapp.appointment.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final UserMapper userMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public AuthResponse registerAdmin(RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new ConflictException("Email is already in use");
        }

        // Generate a URL-safe org slug
        String slug = request.getOrgName().toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .trim()
                .replaceAll("\\s+", "-");

        if (slug.isEmpty()) {
            throw new ConflictException("Invalid organization name");
        }

        if (organizationRepository.findBySlug(slug).isPresent()) {
            throw new ConflictException("Organization name is already in use");
        }

        Organization org = new Organization();
        org.setName(request.getOrgName());
        org.setSlug(slug);
        Organization savedOrg = organizationRepository.save(org);

        User user = new User();
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRole(User.Role.ADMIN);
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setOrganization(savedOrg);

        User savedUser = userRepository.save(user);
        String token = jwtUtils.generateToken(savedUser.getEmail());

        eventPublisher.publishEvent(new LocalOrganisationRegisteredEvent(savedOrg, savedUser));

        return userMapper.toAuthResponse(savedUser, token);
    }

    @Override
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password");
        }

        String token = jwtUtils.generateToken(user.getEmail());
        return userMapper.toAuthResponse(user, token);
    }
}
