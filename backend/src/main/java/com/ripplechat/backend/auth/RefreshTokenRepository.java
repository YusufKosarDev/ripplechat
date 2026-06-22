package com.ripplechat.backend.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    java.util.List<RefreshToken> findAllByUserAndRevokedFalseAndExpiresAtAfter(com.ripplechat.backend.user.User user, java.time.Instant now);

    void deleteAllByUser(com.ripplechat.backend.user.User user);
}
