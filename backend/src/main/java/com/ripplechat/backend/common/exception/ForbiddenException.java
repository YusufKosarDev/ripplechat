package com.ripplechat.backend.common.exception;

/**
 * Thrown when an authenticated user is not allowed to perform an action
 * (e.g. acting on a channel they are not a member of). Mapped to HTTP 403.
 */
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }
}
