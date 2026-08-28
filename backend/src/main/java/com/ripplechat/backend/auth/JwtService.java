package com.ripplechat.backend.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

/**
 * Issues and verifies HMAC-SHA JWT access tokens. jjwt selects the HMAC variant
 * from the key length, so the recommended ≥ 48-byte secret yields HS384.
 */
@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long expirationMillis;

    /** The placeholder shipped in .env.example — never acceptable as a real secret. */
    private static final String EXAMPLE_SECRET = "replace-with-a-long-random-secret-at-least-32-bytes";
    private static final int MIN_SECRET_BYTES = 32; // HMAC signing requires a key of at least 256 bits

    public JwtService(@Value("${jwt.secret}") String secret,
                      @Value("${jwt.access-expiration}") long expirationMillis) {
        validateSecret(secret);
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMillis = expirationMillis;
    }

    /**
     * Fail fast at startup with an actionable message instead of letting a weak
     * or placeholder secret reach production. Catches an unset/too-short key
     * (HMAC needs ≥ 32 bytes) and the example value from .env.example.
     */
    private static void validateSecret(String secret) {
        if (secret == null || secret.isBlank()
                || secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "jwt.secret must be set to at least " + MIN_SECRET_BYTES
                            + " bytes. Generate one with: openssl rand -hex 48");
        }
        if (EXAMPLE_SECRET.equals(secret.trim())) {
            throw new IllegalStateException(
                    "jwt.secret is still the .env.example placeholder — set a real secret "
                            + "(e.g. openssl rand -hex 48)");
        }
    }

    public String generateToken(String username) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMillis);
        return Jwts.builder()
                .subject(username)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey)
                .compact();
    }

    public String generatePreAuthToken(String username) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes pre-auth
        return Jwts.builder()
                .subject(username)
                .claim("preAuth", true)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey)
                .compact();
    }

    /**
     * A verified access token: who it belongs to, and when it was minted.
     *
     * <p>The issue time is what lets {@link TokenRevocationService} decide
     * whether the token predates a sign-out, ban or password change.
     */
    public record VerifiedToken(String username, Instant issuedAt) {
    }

    /**
     * Verifies an access token and returns its subject and issue time, or throws.
     */
    public VerifiedToken verifyAccessToken(String token) {
        Claims claims = parse(token);
        if (claims.get("preAuth", Boolean.class) != null && claims.get("preAuth", Boolean.class)) {
            throw new IllegalArgumentException("Cannot use pre-auth token for normal authentication");
        }
        Date issuedAt = claims.getIssuedAt();
        return new VerifiedToken(claims.getSubject(),
                issuedAt == null ? Instant.EPOCH : issuedAt.toInstant());
    }

    /**
     * Returns the username (subject) if the token is valid, otherwise throws.
     */
    public String extractUsername(String token) {
        return verifyAccessToken(token).username();
    }

    public String extractUsernameFromPreAuthToken(String token) {
        Claims claims = parse(token);
        if (claims.get("preAuth", Boolean.class) == null || !claims.get("preAuth", Boolean.class)) {
            throw new IllegalArgumentException("Invalid pre-auth token");
        }
        return claims.getSubject();
    }

    private Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
