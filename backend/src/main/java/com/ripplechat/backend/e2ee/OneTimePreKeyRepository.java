package com.ripplechat.backend.e2ee;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OneTimePreKeyRepository extends JpaRepository<OneTimePreKey, UUID> {

    /** Fetch one unused OTPKey for the given user (FIFO). */
    Optional<OneTimePreKey> findTopByUserIdOrderByKeyIdAsc(UUID userId);

    List<OneTimePreKey> findAllByUserId(UUID userId);

    long countByUserId(UUID userId);

    void deleteAllByUserId(UUID userId);
}
