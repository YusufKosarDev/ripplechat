package com.ripplechat.backend.common.exception;

/**
 * Thrown for invalid client input that isn't a bean-validation failure. Mapped to HTTP 400.
 */
public class BadRequestException extends RuntimeException {

    public BadRequestException(String message) {
        super(message);
    }
}
