package com.ripplechat.backend.search;

import com.ripplechat.backend.message.Message;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Abstracts the message search backend so the rest of the app does not depend on
 * Elasticsearch directly. Two implementations are wired by the
 * {@code app.search.elasticsearch.enabled} flag:
 *
 * <ul>
 *   <li>{@link ElasticsearchMessageSearchIndex} — the default, full Elasticsearch
 *       engine (n-gram analyzer, sender/date filters).</li>
 *   <li>{@link DatabaseMessageSearchIndex} — a PostgreSQL full-text fallback used
 *       when Elasticsearch is unavailable, so the app still boots and search keeps
 *       working (without the secondary sender/date filters).</li>
 * </ul>
 */
public interface MessageSearchIndex {

    /**
     * Returns the ids of messages matching {@code query} within the given channels,
     * ranked and paged. {@code from} (sender) and {@code since} are honoured by the
     * Elasticsearch backend; the PostgreSQL fallback applies content + channel + paging only.
     */
    List<UUID> searchIds(List<String> channelIds, String query, String from, Instant since, List<String> blockedUsernames, int page, int size);

    /** Adds/updates a message in the index. Best-effort: must never break the send flow. */
    void index(Message message);

    /** Removes a message from the index. Best-effort. */
    void delete(UUID messageId);
}
