package com.ripplechat.backend.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Issues and verifies HS256 JWT access tokens.
 */
@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long expirationMillis;

    /** The placeholder shipped in .env.example — never acceptable as a real secret. */
    private static final String EXAMPLE_SECRET = "replace-with-a-long-random-secret-at-least-32-bytes";
    private static final int MIN_SECRET_BYTES = 32; // HS256 requires a 256-bit key

    public JwtService(@Value("${jwt.secret}") String secret,
                      @Value("${jwt.access-expiration}") long expirationMillis) {
        validateSecret(secret);
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMillis = expirationMillis;
    }

    /**
     * Fail fast at startup with an actionable message instead of letting a weak
     * or placeholder secret reach production. Catches an unset/too-short key
     * (HS256 needs ≥ 32 bytes) and the example value from .env.example.
     */
    private static void validateSecret(String secret) {
        if (secret == null || secret.isBlank()
                || secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "jwt.secret must be set to at least " + MIN_SECRET_BYTES
                            + " bytes (HS256). Generate one with: openssl rand -hex 48");
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
     * Returns the username (subject) if the token is valid, otherwise throws.
     */
    public String extractUsername(String token) {
        Claims claims = parse(token);
        if (claims.get("preAuth", Boolean.class) != null && claims.get("preAuth", Boolean.class)) {
            throw new IllegalArgumentException("Cannot use pre-auth token for normal authentication");
        }
        return claims.getSubject();
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
