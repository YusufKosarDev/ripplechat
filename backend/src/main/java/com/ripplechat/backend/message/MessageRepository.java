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
                     m.created_at desc
            """, nativeQuery = true)
    List<UUID> searchMessageIds(@Param("channelIds") Collection<UUID> channelIds,
                                @Param("tsquery") String tsquery,
                                Pageable pageable);

    /** Loads search hits in bulk, fetch-joining sender and channel for the result view. */
    @Query("""
            select m from Message m
            join fetch m.sender
            join fetch m.channel
            where m.id in :ids
            """)
    List<Message> findForSearchByIds(@Param("ids") Collection<UUID> ids);

    /** Top-level channel messages only (thread replies are excluded from the main feed). */
    @EntityGraph(attributePaths = "sender")
    Page<Message> findByChannelIdAndParentIsNull(UUID channelId, Pageable pageable);

    /** Replies belonging to a thread, oldest first. */
    @EntityGraph(attributePaths = "sender")
    List<Message> findByParent_IdOrderByCreatedAtAsc(UUID parentId);

    /** Replies for several threads at once (for batch thread summaries). */
    @EntityGraph(attributePaths = "sender")
    List<Message> findByParent_IdInOrderByCreatedAtAsc(Collection<UUID> parentIds);
}
