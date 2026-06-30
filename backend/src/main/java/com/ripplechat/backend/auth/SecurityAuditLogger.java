package com.ripplechat.backend.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Emits a structured audit trail for authentication events on a dedicated
 * {@code SECURITY_AUDIT} logger, so they can be filtered/shipped separately.
 * Each line also carries the per-request id (via the MDC log pattern), so an
 * event can be tied back to the originating request. This complements the login
 * rate limiter with visibility, without the denial-of-service surface of a hard
 * account lockout.
 */
@Component
public class SecurityAuditLogger {

    private static final Logger log = LoggerFactory.getLogger("SECURITY_AUDIT");

    public void loginSucceeded(String username) {
        log.info("event=login_success user=\"{}\"", username);
    }

    public void loginFailed(String loginAttempt, String reason) {
        log.warn("event=login_failure login=\"{}\" reason={}", loginAttempt, reason);
    }

    public void loginThrottled(String loginAttempt) {
        log.warn("event=login_throttled login=\"{}\"", loginAttempt);
    }

    public void registered(String username) {
        log.info("event=register user=\"{}\"", username);
    }

    public void tokenRefreshed(String username) {
        log.info("event=token_refresh user=\"{}\"", username);
    }

    public void refreshRejected() {
        log.warn("event=refresh_rejected");
    }

    public void loggedOut() {
        log.info("event=logout");
    }

    public void passwordResetRequested(String username) {
        log.info("event=password_reset_requested user=\"{}\"", username);
    }

    public void passwordReset(String username) {
        log.info("event=password_reset user=\"{}\"", username);
    }

    public void emailVerified(String username) {
        log.info("event=email_verified user=\"{}\"", username);
    }
}
