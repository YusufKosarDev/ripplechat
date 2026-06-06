package com.ripplechat.backend.common.exception;

/**
 * Thrown when creating/updating a resource would violate a uniqueness
 * constraint (e.g. username or email already taken). Mapped to HTTP 409.
 */
public class DuplicateResourceException extends RuntimeException {

    public DuplicateResourceException(String message) {
        super(message);
    }
}
