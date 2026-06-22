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
 * A server-side refresh token. Persisting it is what makes refresh tokens
 * revocable: deleting the row immediately ends that session's ability to mint
 * new access tokens. Only the SHA-256 hash of the opaque token is stored, so a
 * database leak does not expose usable tokens.
 */
@Entity
@Table(name = "refresh_tokens", uniqueConstraints =
        @UniqueConstraint(name = "uk_refresh_token_hash", columnNames = "token_hash"))
@Getter
@Setter
@NoArgsConstructor
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "token_hash", nullable = false, unique = true)
    private String tokenHash;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** When the token expires. */
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** If true, the token has been consumed or invalidated. */
    @Column(nullable = false)
    private boolean revoked = false;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
