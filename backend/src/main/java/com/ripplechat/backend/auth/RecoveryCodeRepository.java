package com.ripplechat.backend.auth;

import com.ripplechat.backend.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RecoveryCodeRepository extends JpaRepository<RecoveryCode, UUID> {

    Optional<RecoveryCode> findByUserAndCodeHashAndUsedFalse(User user, String codeHash);

    long countByUserAndUsedFalse(User user);

    void deleteByUser(User user);
}
