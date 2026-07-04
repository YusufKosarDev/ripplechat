package com.ripplechat.backend.e2ee;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SignedPreKeyRepository extends JpaRepository<SignedPreKey, UUID> {

    Optional<SignedPreKey> findTopByUserIdOrderByCreatedAtDesc(UUID userId);

    void deleteAllByUserId(UUID userId);
}
