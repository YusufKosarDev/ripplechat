package com.ripplechat.backend.message;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MessageEditHistoryRepository extends JpaRepository<MessageEditHistory, UUID> {

    /** All superseded versions of a message, newest first. */
    List<MessageEditHistory> findByMessage_IdOrderByEditedAtDesc(UUID messageId);

    /**
     * Drops a message's history. Deleting a message has to take its earlier
     * versions with it — otherwise the original text of anything that had been
     * edited stayed readable through the history endpoint after the message was
     * gone, which also defeated the disappearing-message timer.
     */
    void deleteByMessage_Id(UUID messageId);
}
