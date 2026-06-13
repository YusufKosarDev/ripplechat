package com.ripplechat.backend.user;

import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.DuplicateResourceException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.user.dto.ChangePasswordRequest;
import com.ripplechat.backend.user.dto.UpdateMeRequest;
import com.ripplechat.backend.user.dto.UserResponse;
import com.ripplechat.backend.user.dto.UserSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    // Avatar URLs must be ones we issued (Cloudinary), never arbitrary client input.
    private static final String AVATAR_URL_PREFIX = "https://res.cloudinary.com/";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public UserResponse findByUsername(String username) {
        return userRepository.findByUsername(username)
                .map(UserResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
    }

    /**
     * Finds users by username or display name for the direct-message picker.
     * Requires at least 2 characters, returns a safe summary (no PII), excludes
     * the caller, and caps the result count.
     */
    @Transactional(readOnly = true)
    public List<UserSummary> search(String query, String excludeUsername) {
        String q = query == null ? "" : query.trim();
        if (q.length() < 2) {
            return List.of();
        }
        return userRepository.searchByUsernameOrDisplayName(q, PageRequest.of(0, 10)).stream()
                .filter(u -> !u.getUsername().equals(excludeUsername))
                .map(UserSummary::from)
                .toList();
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
        if (request.avatarUrl() != null) {
            String url = request.avatarUrl().trim();
            if (url.isEmpty()) {
                user.setAvatarUrl(null);
            } else if (url.startsWith(AVATAR_URL_PREFIX)) {
                user.setAvatarUrl(url);
            } else {
                throw new BadRequestException("invalid avatar url");
            }
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
