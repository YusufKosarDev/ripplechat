package com.ripplechat.backend.webhook;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WebhookRepository extends JpaRepository<Webhook, UUID> {

    Optional<Webhook> findByTokenHash(String tokenHash);

    @EntityGraph(attributePaths = "botUser")
    List<Webhook> findByChannelIdOrderByCreatedAtAsc(UUID channelId);
}
