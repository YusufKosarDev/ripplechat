package com.ripplechat.backend.auth;

import com.ripplechat.backend.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findAllByUserAndRevokedFalseAndExpiresAtAfter(User user, Instant now);

    void deleteAllByUser(User user);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.revoked = true WHERE r.tokenHash = :tokenHash AND r.revoked = false")
    int revokeToken(@Param("tokenHash") String tokenHash);
}
