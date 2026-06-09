package com.ripplechat.backend.user.dto;

public record ChangePasswordRequest(
        String currentPassword,
        String newPassword
) {
}
