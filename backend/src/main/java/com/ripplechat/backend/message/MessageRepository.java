package com.ripplechat.backend.message;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    /**
     * Full-text message search within the given channels (excludes deleted),
     * ranked by relevance. Matches a 'simple' tsvector against a prefix tsquery;
     * a functional GIN index on to_tsvector('simple', content) backs it in prod.
     * Returns ids only so the rows can be fetch-joined afterwards without N+1.
     */
    @Query(value = """
            select m.id
            from messages m
            where m.channel_id in (:channelIds)
              and m.deleted = false
              and to_tsvector('simple', m.content) @@ to_tsquery('simple', :tsquery)
            order by ts_rank(to_tsvector('simple', m.content), to_tsquery('simple', :tsquery)) desc,
                     m.created_at desc,
                     m.id desc
            """, nativeQuery = true)
    List<UUID> searchMessageIds(@Param("channelIds") Collection<UUID> channelIds,
                                @Param("tsquery") String tsquery,
                                Pageable pageable);

    /** Pinned messages of a channel, newest first (sender fetched for the view). */
    @EntityGraph(attributePaths = "sender")
    List<Message> findByChannelIdAndPinnedTrueAndDeletedFalseOrderByCreatedAtDesc(UUID channelId);

    /** Image attachments of a channel, newest first (for the media gallery). */
    @EntityGraph(attributePaths = "sender")
    List<Message> findByChannelIdAndAttachmentUrlIsNotNullAndDeletedFalseOrderByCreatedAtDesc(UUID channelId);

    /** Loads search hits in bulk, fetch-joining sender and channel for the result view. */
    @Query("""
            select m from Message m
            join fetch m.sender
            join fetch m.channel
            where m.id in :ids
            """)
    List<Message> findForSearchByIds(@Param("ids") Collection<UUID> ids);

    /**
     * Top-level channel feed for a viewer: excludes thread replies and messages
     * the viewer has hidden ("delete for me").
     */
    @EntityGraph(attributePaths = "sender")
    @Query(value = """
            select m from Message m
            where m.channel.id = :channelId and m.parent is null
              and not exists (select 1 from MessageHide h where h.messageId = m.id and h.userId = :userId)
              and not exists (select 1 from UserBlock b where b.blockerId = :userId and b.blockedId = m.sender.id)
            """,
            countQuery = """
            select count(m) from Message m
            where m.channel.id = :channelId and m.parent is null
              and not exists (select 1 from MessageHide h where h.messageId = m.id and h.userId = :userId)
              and not exists (select 1 from UserBlock b where b.blockerId = :userId and b.blockedId = m.sender.id)
            """)
    Page<Message> findChannelFeed(@Param("channelId") UUID channelId,
                                  @Param("userId") UUID userId,
                                  Pageable pageable);

    /** Replies belonging to a thread, oldest first. */
    @EntityGraph(attributePaths = "sender")
    List<Message> findByParent_IdOrderByCreatedAtAsc(UUID parentId);

    /** Replies for several threads at once (for batch thread summaries). */
    @EntityGraph(attributePaths = "sender")
    List<Message> findByParent_IdInOrderByCreatedAtAsc(Collection<UUID> parentIds);

    /** Disappearing messages whose expiry has passed and aren't soft-deleted yet. */
    List<Message> findByExpiresAtLessThanEqualAndDeletedFalse(java.time.Instant cutoff);

    /** A user's authored messages, for the GDPR data export. */
    List<Message> findBySender_IdOrderByCreatedAtAsc(UUID senderId);
}
