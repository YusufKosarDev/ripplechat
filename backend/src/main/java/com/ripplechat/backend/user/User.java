package com.ripplechat.backend.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Enumerated;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * A RippleChat user. Password is intentionally omitted for now — it will be
 * added in the auth/security step.
 *
 * Table is named "users" because "user" is a reserved word in PostgreSQL.
 */
@Entity
@Table(name = "users", uniqueConstraints = {
        @UniqueConstraint(name = "uk_users_username", columnNames = "username"),
        @UniqueConstraint(name = "uk_users_email", columnNames = "email")
})
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "display_name")
    private String displayName;

    /** Preferred avatar color key (e.g. "indigo"); null → derived from the name. */
    @Column(name = "avatar_color")
    private String avatarColor;

    /** Uploaded avatar image URL (Cloudinary); null → fall back to the color initial. */
    @Column(name = "avatar_url", length = 1024)
    private String avatarUrl;

    /** Last time the user went offline (their last WebSocket connection closed). */
    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    /** BCrypt-hashed password. Nullable because OAuth2 users do not have a local password. */
    @Column
    private String password;

    @Enumerated(jakarta.persistence.EnumType.STRING)
    @Column(name = "auth_provider", nullable = false)
    private AuthProvider authProvider = AuthProvider.LOCAL;

    @Column(name = "provider_id")
    private String providerId;

    @Column(name = "totp_secret")
    private String totpSecret;

    @Column(name = "is_two_factor_enabled", nullable = false)
    private boolean isTwoFactorEnabled = false;

    @Column(name = "public_key")
    private String publicKey;

    /** Custom status: a short emoji and/or text (e.g. "🌴" / "On vacation"). */
    @Column(name = "status_emoji", length = 16)
    private String statusEmoji;

    @Column(name = "status_text", length = 100)
    private String statusText;

    /** When set, the status clears itself once this instant has passed. */
    @Column(name = "status_expires_at")
    private Instant statusExpiresAt;

    /** Do-Not-Disturb until this instant; while active, web push is suppressed. */
    @Column(name = "dnd_until")
    private Instant dndUntil;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** A status is shown only if it has content and has not expired. */
    public boolean isStatusActive() {
        return (statusEmoji != null || statusText != null)
                && (statusExpiresAt == null || statusExpiresAt.isAfter(Instant.now()));
    }

    /** True while the user is within their Do-Not-Disturb window. */
    public boolean isDndActive() {
        return dndUntil != null && dndUntil.isAfter(Instant.now());
    }
}
