package com.ripplechat.backend.user.dto;

/**
 * Confirms account deletion. The password is required for local accounts (to
 * re-assert identity); OAuth-only accounts have no local password and are
 * deleted on the strength of the authenticated session alone.
 */
public record DeleteAccountRequest(String password) {
}
