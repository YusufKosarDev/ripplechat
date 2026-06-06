package com.ripplechat.backend.common.exception;

/**
 * Thrown when login credentials do not match. Mapped to HTTP 401.
 */
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException(String message) {
        super(message);
    }
}
