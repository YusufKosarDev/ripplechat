package com.ripplechat.backend.message;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MessageEditHistoryRepository extends JpaRepository<MessageEditHistory, UUID> {

    /** All superseded versions of a message, newest first. */
    List<MessageEditHistory> findByMessage_IdOrderByEditedAtDesc(UUID messageId);
}
