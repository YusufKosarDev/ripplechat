package com.ripplechat.backend.auth;

import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.mail.MailService;
import com.ripplechat.backend.redis.RateLimiter;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Email verification and password reset: mints single-use, expiring tokens
 * ({@link AuthToken}, hash-only storage), emails the action link via
 * {@link MailService}, and consumes the token to apply the action. Endpoints
 * deliberately never reveal whether an email/account exists.
 */
@Service
@RequiredArgsConstructor
public class AccountService {

    private static final Duration VERIFICATION_TTL = Duration.ofHours(24);
    private static final Duration RESET_TTL = Duration.ofHours(1);

    // Password-reset request throttle, keyed by client IP: ~3 burst, then ~1/min.
    // Caps reset-email spam without a hard lockout.
    private static final double RESET_BURST = 3;
    private static final double RESET_REFILL_PER_SEC = 0.0167;

    private final UserRepository userRepository;
    private final AuthTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final RefreshTokenService refreshTokenService;
    private final RateLimiter rateLimiter;
    private final SecurityAuditLogger audit;

    @Value("${app.frontend-base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    private final SecureRandom random = new SecureRandom();

    // --- Email verification -------------------------------------------------

    /** Issues a verification token and emails the confirmation link. */
    @Transactional
    public void sendVerificationEmail(User user) {
        if (user.isEmailVerified()) {
            return;
        }
        String raw = issueToken(user, AuthToken.TYPE_EMAIL_VERIFICATION, VERIFICATION_TTL);
        String link = frontendBaseUrl + "/verify-email?token=" + raw;
        mailService.send(user.getEmail(), "Verify your RippleChat email",
                "Welcome to RippleChat! Confirm your email address by opening:\n\n" + link
                        + "\n\nThis link expires in 24 hours. If you didn't sign up, you can ignore this message.");
    }

    /** Re-sends verification for the signed-in user (no-op if already verified). */
    @Transactional
    public void resendVerification(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found"));
        sendVerificationEmail(user);
    }

    /** Consumes a verification token and marks the user's email verified. */
    @Transactional
    public void verifyEmail(String rawToken) {
        AuthToken token = consume(rawToken, AuthToken.TYPE_EMAIL_VERIFICATION);
        User user = token.getUser();
        user.setEmailVerified(true);
        audit.emailVerified(user.getUsername());
    }

    // --- Password reset -----------------------------------------------------

    /**
     * Starts a password reset for the address, if it belongs to a local account.
     * Always succeeds silently — the caller returns 204 regardless — so the
     * endpoint can't be used to discover which emails are registered.
     */
    @Transactional
    public void requestPasswordReset(String email, String ipAddress) {
        if (ipAddress != null
                && !rateLimiter.tryAcquire("pwreset:" + ipAddress, RESET_BURST, RESET_REFILL_PER_SEC)) {
            // Silently drop excess requests; still no signal about account existence.
            return;
        }
        userRepository.findByEmail(email).ifPresent(user -> {
            if (user.getPassword() == null) {
                // OAuth-only account: nothing to reset, and we don't disclose that.
                return;
            }
            String raw = issueToken(user, AuthToken.TYPE_PASSWORD_RESET, RESET_TTL);
            String link = frontendBaseUrl + "/reset-password?token=" + raw;
            mailService.send(user.getEmail(), "Reset your RippleChat password",
                    "We received a request to reset your RippleChat password. Open this link to choose a new one:\n\n"
                            + link + "\n\nThis link expires in 1 hour. If you didn't request this, you can ignore "
                            + "this message — your password won't change.");
            audit.passwordResetRequested(user.getUsername());
        });
    }

    /** Consumes a reset token, sets the new password, and ends all sessions. */
    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        AuthToken token = consume(rawToken, AuthToken.TYPE_PASSWORD_RESET);
        User user = token.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        // A reset is a security event: drop every existing refresh token so any
        // session opened before the reset (incl. an attacker's) is invalidated.
        refreshTokenService.revokeAll(user);
        audit.passwordReset(user.getUsername());
    }

    // --- Helpers ------------------------------------------------------------

    private String issueToken(User user, String type, Duration ttl) {
        // Only one outstanding token of each kind per user — issuing a new one
        // invalidates any previous link.
        tokenRepository.deleteByUserAndType(user, type);
        String raw = randomToken();
        AuthToken token = new AuthToken();
        token.setTokenHash(hash(raw));
        token.setUser(user);
        token.setType(type);
        token.setExpiresAt(Instant.now().plus(ttl));
        tokenRepository.save(token);
        return raw;
    }

    private AuthToken consume(String rawToken, String expectedType) {
        AuthToken token = tokenRepository.findByTokenHash(hash(rawToken))
                .filter(t -> t.getType().equals(expectedType))
                .orElseThrow(() -> new BadRequestException("invalid or expired link"));
        if (token.isUsed() || token.isExpired()) {
            throw new BadRequestException("invalid or expired link");
        }
        token.setUsed(true);
        return token;
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
