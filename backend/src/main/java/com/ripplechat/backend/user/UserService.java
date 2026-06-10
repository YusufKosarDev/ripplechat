package com.ripplechat.backend.user;

import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.DuplicateResourceException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.user.dto.ChangePasswordRequest;
import com.ripplechat.backend.user.dto.UpdateMeRequest;
import com.ripplechat.backend.user.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public UserResponse findByUsername(String username) {
        return userRepository.findByUsername(username)
                .map(UserResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
    }

    /** Self profile update — the authenticated user can only edit their own profile. */
    @Transactional
    public UserResponse updateMe(String username, UpdateMeRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        if (request.email() != null && !request.email().isBlank()
                && !request.email().equalsIgnoreCase(user.getEmail())) {
            if (userRepository.existsByEmailAndIdNot(request.email(), user.getId())) {
                throw new DuplicateResourceException("email already registered: " + request.email());
            }
            user.setEmail(request.email().trim());
        }
        if (request.displayName() != null && !request.displayName().isBlank()) {
            user.setDisplayName(request.displayName().trim());
        }
        if (request.avatarColor() != null) {
            user.setAvatarColor(request.avatarColor().isBlank() ? null : request.avatarColor().trim());
        }
        return UserResponse.from(userRepository.saveAndFlush(user));
    }

    @Transactional
    public void changePassword(String username, ChangePasswordRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        if (request.currentPassword() == null
                || !passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new BadRequestException("mevcut şifre yanlış");
        }
        if (request.newPassword() == null || request.newPassword().length() < 8) {
            throw new BadRequestException("yeni şifre en az 8 karakter olmalı");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }
}
