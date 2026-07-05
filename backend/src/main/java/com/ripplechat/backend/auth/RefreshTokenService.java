package com.ripplechat.backend.auth;

import com.ripplechat.backend.common.exception.InvalidCredentialsException;
import com.ripplechat.backend.user.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Issues, rotates and revokes opaque refresh tokens. The raw token returned to
 * the client is high-entropy random; only its SHA-256 hash is persisted.
 */
@Service
public class RefreshTokenService {

    private final RefreshTokenRepository repository;
    private final long refreshExpirationMillis;
    private final SecureRandom random = new SecureRandom();

    public RefreshTokenService(RefreshTokenRepository repository,
                               @Value("${jwt.refresh-expiration}") long refreshExpirationMillis) {
        this.repository = repository;
        this.refreshExpirationMillis = refreshExpirationMillis;
    }

    /** Mints a new refresh token for the user and returns the raw value. */
    @Transactional
    public String issue(User user) {
        return issue(user, null, null);
    }

    /** Mints a new refresh token for the user with session metadata and returns the raw value. */
    @Transactional
    public String issue(User user, String ipAddress, String userAgent) {
        RefreshToken token = new RefreshToken();
        String raw = randomToken();
        token.setTokenHash(hash(raw));
        token.setUser(user);
        token.setIpAddress(ipAddress);
        token.setUserAgent(userAgent);
        token.setExpiresAt(Instant.now().plusMillis(refreshExpirationMillis));
        repository.save(token);
        return raw;
    }

    @Transactional(readOnly = true)
    public java.util.List<RefreshToken> getActiveSessions(User user) {
        return repository.findAllByUserAndRevokedFalseAndExpiresAtAfter(user, Instant.now());
    }

    @Transactional
    public void revokeSession(User user, java.util.UUID sessionId) {
        repository.findById(sessionId).ifPresent(token -> {
            if (token.getUser().getId().equals(user.getId())) {
                repository.delete(token);
            }
        });
    }

    /**
     * Validates and consumes a refresh token (one-time use): the row is atomically updated
     * so that the same token can never be replayed concurrently, and the caller issues a fresh one
     * (rotation). Throws if the token is unknown, already revoked (replay) or expired.
     */
    @Transactional
    public User rotate(String rawToken) {
        String tokenHash = hash(rawToken);
        RefreshToken token = repository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new InvalidCredentialsException("invalid refresh token"));
        User user = token.getUser();

        // A disabled (banned) or erased account may never renew a session, even
        // with an otherwise-valid refresh token. Nuke all their tokens on the way out.
        if (!user.canAuthenticate()) {
            repository.deleteAllByUser(user);
            throw new InvalidCredentialsException("account is no longer active");
        }

        boolean expired = token.getExpiresAt().isBefore(Instant.now());

        // Perform the atomic revocation check.
        // If it returns 0, it means it was already revoked (race condition or replay).
        int updatedRows = repository.revokeToken(tokenHash);
        if (updatedRows == 0 || token.isRevoked()) {
            // Replay attack detected: token was already used!
            repository.deleteAllByUser(user);
            throw new InvalidCredentialsException("refresh token replay detected; all sessions revoked");
        }
        
        if (expired) {
            throw new InvalidCredentialsException("refresh token expired");
        }
        return user;
    }

    /** Revokes a refresh token if present (logout); unknown tokens are ignored. */
    @Transactional
    public void revoke(String rawToken) {
        repository.findByTokenHash(hash(rawToken)).ifPresent(repository::delete);
    }

    /** Ends every session for a user (e.g. after a password reset). */
    @Transactional
    public void revokeAll(User user) {
        repository.deleteAllByUser(user);
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
