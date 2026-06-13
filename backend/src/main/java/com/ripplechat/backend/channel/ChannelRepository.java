package com.ripplechat.backend.channel;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ChannelRepository extends JpaRepository<Channel, UUID> {

    /** Used by the demo seeder to locate a seeded channel (idempotent re-seeding). */
    Optional<Channel> findFirstByNameAndCreatedBy_UsernameAndDeletedFalse(String name, String username);

    /** Finds the direct-message channel for a user pair, if one already exists. */
    Optional<Channel> findByDmKey(String dmKey);
}
