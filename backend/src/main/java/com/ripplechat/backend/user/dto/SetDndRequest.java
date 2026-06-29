package com.ripplechat.backend.user.dto;

/**
 * Enables Do-Not-Disturb for {@code minutes} from now; null or non-positive clears it.
 */
public record SetDndRequest(Long minutes) {
}
