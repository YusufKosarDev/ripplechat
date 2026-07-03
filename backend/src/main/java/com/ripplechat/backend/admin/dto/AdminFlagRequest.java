package com.ripplechat.backend.admin.dto;

/** Body for toggling a boolean flag (admin, disabled) on a user. */
public record AdminFlagRequest(boolean value) {
}
