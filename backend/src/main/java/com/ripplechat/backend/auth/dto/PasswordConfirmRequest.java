package com.ripplechat.backend.auth.dto;

/**
 * Re-confirmation of the account password before a sensitive change.
 *
 * <p>Optional in the shape: an account created through Google has no local
 * password, and for those the session is the only credential there is.
 */
public record PasswordConfirmRequest(String password) {
}
