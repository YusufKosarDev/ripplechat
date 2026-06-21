package com.ripplechat.backend.common.error;

/** A single field-level validation failure, attached to a problem response. */
public record FieldValidationError(String field, String message) {
}
