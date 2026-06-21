package com.ripplechat.backend.auth;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Pure unit tests for JWT issue/verify — no Spring context. */
class JwtServiceTest {

    private static final String SECRET = "unit-test-secret-key-at-least-32-bytes-long-xyz";

    @Test
    void generatesTokenAndExtractsSubject() {
        JwtService jwt = new JwtService(SECRET, 3_600_000L);
        String token = jwt.generateToken("alice");
        assertThat(jwt.extractUsername(token)).isEqualTo("alice");
    }

    @Test
    void rejectsTamperedToken() {
        JwtService jwt = new JwtService(SECRET, 3_600_000L);
        String token = jwt.generateToken("alice");
        String tampered = token.substring(0, token.length() - 1) + (token.endsWith("a") ? "b" : "a");
        assertThatThrownBy(() -> jwt.extractUsername(tampered)).isInstanceOf(Exception.class);
    }

    @Test
    void rejectsTokenSignedWithAnotherSecret() {
        JwtService issuer = new JwtService(SECRET, 3_600_000L);
        JwtService verifier = new JwtService("a-completely-different-secret-key-32-bytes-min", 3_600_000L);
        String token = issuer.generateToken("alice");
        assertThatThrownBy(() -> verifier.extractUsername(token)).isInstanceOf(Exception.class);
    }

    @Test
    void rejectsExpiredToken() {
        JwtService jwt = new JwtService(SECRET, -1_000L); // expiry in the past
        String token = jwt.generateToken("alice");
        assertThatThrownBy(() -> jwt.extractUsername(token)).isInstanceOf(Exception.class);
    }

    @Test
    void rejectsTooShortSecret() {
        assertThatThrownBy(() -> new JwtService("too-short", 3_600_000L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32 bytes");
    }

    @Test
    void rejectsExamplePlaceholderSecret() {
        assertThatThrownBy(
                () -> new JwtService("replace-with-a-long-random-secret-at-least-32-bytes", 3_600_000L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("placeholder");
    }
}
