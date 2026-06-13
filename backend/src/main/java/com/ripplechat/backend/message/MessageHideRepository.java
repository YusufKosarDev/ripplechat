package com.ripplechat.backend.message;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MessageHideRepository extends JpaRepository<MessageHide, UUID> {

    boolean existsByMessageIdAndUserId(UUID messageId, UUID userId);
}
