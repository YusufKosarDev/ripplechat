package com.ripplechat.backend.bookmark;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface SavedMessageRepository extends JpaRepository<SavedMessage, UUID> {

    boolean existsByMessageIdAndUserId(UUID messageId, UUID userId);

    @Transactional
    void deleteByMessageIdAndUserId(UUID messageId, UUID userId);

    List<SavedMessage> findByUserIdOrderBySavedAtDesc(UUID userId, Pageable pageable);

    List<SavedMessage> findByUserId(UUID userId);
}
