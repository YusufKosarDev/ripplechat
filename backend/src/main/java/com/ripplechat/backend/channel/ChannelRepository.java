package com.ripplechat.backend.channel;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChannelRepository extends JpaRepository<Channel, UUID> {

    /**
     * Channels visible to a user: non-deleted regular channels (not DMs) that are
     * either public or one the user belongs to. Filtering in the query avoids
     * loading every channel into memory just to discard most of them.
     */
    @Query("""
            select c from Channel c
            where c.deleted = false
              and c.type = com.ripplechat.backend.channel.ChannelType.CHANNEL
              and (c.isPrivate = false
                   or exists (select 1 from ChannelMembership m
                              where m.channel = c and m.user.username = :username))
            order by c.createdAt
            """)
    List<Channel> findVisibleChannels(@Param("username") String username);

    /**
     * Public, non-deleted channels the user is <em>not</em> already in — the
     * "discover / browse channels" list. Private channels and DMs are excluded.
     */
    @Query("""
            select c from Channel c
            where c.deleted = false
              and c.type = com.ripplechat.backend.channel.ChannelType.CHANNEL
              and c.isPrivate = false
              and not exists (select 1 from ChannelMembership m
                              where m.channel = c and m.user.username = :username)
            order by c.name
            """)
    List<Channel> findDiscoverableChannels(@Param("username") String username);

    /** Used by the demo seeder to locate a seeded channel (idempotent re-seeding). */
    Optional<Channel> findFirstByNameAndCreatedBy_UsernameAndDeletedFalse(String name, String username);

    /** Finds the direct-message channel for a user pair, if one already exists. */
    Optional<Channel> findByDmKey(String dmKey);
}
