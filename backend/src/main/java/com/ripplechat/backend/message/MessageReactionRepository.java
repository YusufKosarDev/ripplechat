package com.ripplechat.backend.message;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageReactionRepository extends JpaRepository<MessageReaction, UUID> {

    Optional<MessageReaction> findByMessage_IdAndUser_UsernameAndEmoji(
            UUID messageId, String username, String emoji);

    List<MessageReaction> findByMessage_Id(UUID messageId);

    List<MessageReaction> findByMessage_IdIn(Collection<UUID> messageIds);
}
