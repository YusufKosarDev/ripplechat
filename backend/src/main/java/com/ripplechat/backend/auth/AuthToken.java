package com.ripplechat.backend.auth;

import com.ripplechat.backend.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * A single-use, expiring token for an out-of-band account action — email
 * verification or password reset. Like {@link RefreshToken}, only the SHA-256
 * hash of the opaque token is stored, so a database leak does not expose usable
 * links. {@code type} is a plain string (not a JPA enum) to avoid a Hibernate
 * CHECK constraint that would otherwise need migrating whenever a value is added.
 */
@Entity
@Table(name = "auth_tokens", uniqueConstraints =
        @UniqueConstraint(name = "uk_auth_token_hash", columnNames = "token_hash"))
@Getter
@Setter
@NoArgsConstructor
public class AuthToken {

    public static final String TYPE_EMAIL_VERIFICATION = "EMAIL_VERIFICATION";
    public static final String TYPE_PASSWORD_RESET = "PASSWORD_RESET";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "token_hash", nullable = false, unique = true)
    private String tokenHash;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 40)
    private String type;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** Once consumed, the token can never be used again. */
    @Column(nullable = false)
    private boolean used = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public boolean isExpired() {
        return expiresAt.isBefore(Instant.now());
    }
}
