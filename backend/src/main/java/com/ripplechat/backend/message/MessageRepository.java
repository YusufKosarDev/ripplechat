package com.ripplechat.backend.message;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
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

    /**
     * {@link #searchMessageIds} plus the sender, date and blocked-author filters,
     * so the PostgreSQL fallback matches what the Elasticsearch path applies.
     * Blocked authors are excluded here as well as during hydration: this query
     * ranks and pages the ids, so leaving them in lets a blocked message occupy
     * a slot and hand back a short page.
     *
     * <p>Every parameter is non-null by contract — the caller passes a
     * match-everything default instead ({@code "%"}, {@link java.time.Instant#EPOCH},
     * a single-element sentinel list). That keeps the SQL free of null casts and
     * avoids rendering an empty {@code in ()}, which PostgreSQL rejects at parse
     * time even when the surrounding condition would short-circuit.
     */
    @Query(value = """
            select m.id
            from messages m
            join users u on u.id = m.sender_id
            where m.channel_id in (:channelIds)
              and m.deleted = false
              and to_tsvector('simple', m.content) @@ to_tsquery('simple', :tsquery)
              and lower(u.username) like :senderLike
              and m.created_at >= :since
              and u.username not in (:blockedUsernames)
            order by ts_rank(to_tsvector('simple', m.content), to_tsquery('simple', :tsquery)) desc,
                     m.created_at desc,
                     m.id desc
            """, nativeQuery = true)
    List<UUID> searchMessageIdsFiltered(@Param("channelIds") Collection<UUID> channelIds,
                                        @Param("tsquery") String tsquery,
                                        @Param("senderLike") String senderLike,
                                        @Param("since") Instant since,
                                        @Param("blockedUsernames") Collection<String> blockedUsernames,
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

    /** Loads search hits in bulk, fetch-joining sender and channel. Excludes blocked users. */
    @Query("""
            select m from Message m
            join fetch m.sender
            join fetch m.channel
            where m.id in :ids
              and not exists (select 1 from UserBlock b where b.blockerId = :userId and b.blockedId = m.sender.id)
            """)
    List<Message> findForSearchByIdsFiltered(@Param("ids") Collection<UUID> ids, @Param("userId") UUID userId);

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

    /** Replies belonging to a thread, oldest first, excluding blocked users. */
    @EntityGraph(attributePaths = "sender")
    @Query("""
            select m from Message m
            where m.parent.id = :parentId
              and not exists (select 1 from UserBlock b where b.blockerId = :userId and b.blockedId = m.sender.id)
            order by m.createdAt asc
            """)
    List<Message> findThreadReplies(@Param("parentId") UUID parentId, @Param("userId") UUID userId);

    /** Replies for several threads at once (for batch thread summaries). */
    @EntityGraph(attributePaths = "sender")
    List<Message> findByParent_IdInOrderByCreatedAtAsc(Collection<UUID> parentIds);

    /** Disappearing messages whose expiry has passed and aren't soft-deleted yet. */
    List<Message> findByExpiresAtLessThanEqualAndDeletedFalse(Instant cutoff, Pageable pageable);

    /**
     * Messages carrying a denormalised quote of the given message, so the
     * snapshot can be scrubbed when the original is deleted.
     */
    List<Message> findByQuotedMessageId(UUID quotedMessageId);

    /** A user's authored messages, for the GDPR data export. */
    List<Message> findBySender_IdOrderByCreatedAtAsc(UUID senderId);

    @Query(value = """
            SELECT m.parent_message_id, COUNT(*)
            FROM messages m
            WHERE m.parent_message_id IN (:parentIds) AND m.deleted = false
            GROUP BY m.parent_message_id
            """, nativeQuery = true)
    List<Object[]> findReplyCounts(@Param("parentIds") Collection<UUID> parentIds);

    @Query(value = """
            WITH distinct_senders AS (
                SELECT 
                    m.parent_message_id, 
                    m.sender_id,
                    MAX(m.created_at) as max_created
                FROM messages m
                WHERE m.parent_message_id IN (:parentIds) AND m.deleted = false
                GROUP BY m.parent_message_id, m.sender_id
            ),
            ranked_senders AS (
                SELECT 
                    parent_message_id,
                    sender_id,
                    ROW_NUMBER() OVER (PARTITION BY parent_message_id ORDER BY max_created DESC) as rn
                FROM distinct_senders
            )
            SELECT parent_message_id, sender_id
            FROM ranked_senders
            WHERE rn <= 3
            """, nativeQuery = true)
    List<Object[]> findLastReplierIds(@Param("parentIds") Collection<UUID> parentIds);
}
