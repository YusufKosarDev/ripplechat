package com.ripplechat.backend.push;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, UUID> {

    boolean existsByEndpoint(String endpoint);

    List<PushSubscription> findByUserIdIn(Collection<UUID> userIds);

    @Transactional
    void deleteByEndpoint(String endpoint);

    @Transactional
    void deleteByUserId(UUID userId);
}
