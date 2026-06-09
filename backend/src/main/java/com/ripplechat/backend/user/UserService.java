package com.ripplechat.backend.user;

import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.DuplicateResourceException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.user.dto.ChangePasswordRequest;
import com.ripplechat.backend.user.dto.UpdateMeRequest;
import com.ripplechat.backend.user.dto.UpdateUserRequest;
import com.ripplechat.backend.user.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public List<UserResponse> findAll() {
        return userRepository.findAll().stream()
                .map(UserResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public UserResponse findById(UUID id) {
        return UserResponse.from(getOrThrow(id));
    }

    @Transactional(readOnly = true)
    public UserResponse findByUsername(String username) {
        return userRepository.findByUsername(username)
                .map(UserResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
    }

    @Transactional
    public UserResponse update(UUID id, UpdateUserRequest request) {
        User user = getOrThrow(id);

        // Only reject the email if it belongs to a different user.
        if (userRepository.existsByEmailAndIdNot(request.email(), id)) {
            throw new DuplicateResourceException("email already registered: " + request.email());
        }

        user.setEmail(request.email());
        user.setDisplayName(request.displayName());

        return UserResponse.from(userRepository.save(user));
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

    @Transactional
    public void delete(UUID id) {
        if (!userRepository.existsById(id)) {
            throw new ResourceNotFoundException("user not found: " + id);
        }
        userRepository.deleteById(id);
    }

    private User getOrThrow(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + id));
    }
}
