package com.ripplechat.backend.message;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    /** Top-level channel messages only (thread replies are excluded from the main feed). */
    Page<Message> findByChannelIdAndParentIsNull(UUID channelId, Pageable pageable);

    /** Replies belonging to a thread, oldest first. */
    List<Message> findByParent_IdOrderByCreatedAtAsc(UUID parentId);

    /** Replies for several threads at once (for batch thread summaries). */
    List<Message> findByParent_IdInOrderByCreatedAtAsc(Collection<UUID> parentIds);
}
