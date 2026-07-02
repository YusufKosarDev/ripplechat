package com.ripplechat.backend.auth;

import com.ripplechat.backend.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AuthTokenRepository extends JpaRepository<AuthToken, UUID> {

    Optional<AuthToken> findByTokenHash(String tokenHash);

    /** Drops any outstanding tokens of a kind for a user (e.g. before issuing a fresh one). */
    void deleteByUserAndType(User user, String type);

    /** Drops all of a user's tokens (e.g. on account deletion). */
    void deleteByUser(User user);
}
