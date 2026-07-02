package com.ripplechat.backend.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface UserBlockRepository extends JpaRepository<UserBlock, UUID> {

    boolean existsByBlockerIdAndBlockedId(UUID blockerId, UUID blockedId);

    List<UserBlock> findByBlockerId(UUID blockerId);

    @Transactional
    void deleteByBlockerIdAndBlockedId(UUID blockerId, UUID blockedId);

    /** Removes every block involving the user (as blocker or as blocked). */
    @Transactional
    void deleteByBlockerId(UUID blockerId);

    @Transactional
    void deleteByBlockedId(UUID blockedId);
}
