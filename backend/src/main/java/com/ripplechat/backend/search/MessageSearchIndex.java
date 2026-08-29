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
 *   <li>{@link DatabaseMessageSearchIndex} — PostgreSQL full-text, the default.
 *       Needs no extra infrastructure, so search works on a fresh clone.</li>
 *   <li>{@link ElasticsearchMessageSearchIndex} — opt-in via the flag, for a
 *       deployment that actually runs Elasticsearch (n-gram analyzer, BM25).</li>
 * </ul>
 *
 * <p>Both apply the same channel, sender, date and blocked-author filters; only
 * the ranking function differs.</p>
 */
public interface MessageSearchIndex {

    /**
     * Returns the ids of messages matching {@code query} within the given channels,
     * ranked and paged. {@code from} (sender), {@code since} and
     * {@code blockedUsernames} are honoured by both backends. Blocked authors are
     * filtered again during hydration, but an implementation must still exclude
     * them here or they consume slots in the ranked page.
     */
    List<UUID> searchIds(List<String> channelIds, String query, String from, Instant since, List<String> blockedUsernames, int page, int size);

    /**
     * Whether this backend needs to be told about changes at all.
     *
     * <p>False for PostgreSQL, where the rows are the index: queuing an outbox
     * task per message for a no-op would be pure churn on the default
     * deployment, which is the one that runs without Elasticsearch.
     */
    boolean requiresIndexing();

    /**
     * Adds or updates a message in the index.
     *
     * <p>Called by the outbox processor, so a failure must be <em>thrown</em>:
     * that is what schedules the retry. Swallowing it meant a message the
     * cluster happened to reject was silently never searchable.
     */
    void index(Message message);

    /** Removes a message from the index. Throws on failure, so it is retried. */
    void delete(UUID messageId);
}
