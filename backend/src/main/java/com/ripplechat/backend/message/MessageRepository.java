package com.ripplechat.backend.message;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    /** Case-insensitive content search within the given channels (excludes deleted). */
    @Query("""
            select m from Message m
            where m.channel.id in :channelIds
              and m.deleted = false
              and lower(m.content) like lower(concat('%', :q, '%'))
            order by m.createdAt desc
            """)
    List<Message> search(@Param("channelIds") Collection<UUID> channelIds,
                         @Param("q") String q,
                         Pageable pageable);

    /** Top-level channel messages only (thread replies are excluded from the main feed). */
    Page<Message> findByChannelIdAndParentIsNull(UUID channelId, Pageable pageable);

    /** Replies belonging to a thread, oldest first. */
    List<Message> findByParent_IdOrderByCreatedAtAsc(UUID parentId);

    /** Replies for several threads at once (for batch thread summaries). */
    List<Message> findByParent_IdInOrderByCreatedAtAsc(Collection<UUID> parentIds);
}
