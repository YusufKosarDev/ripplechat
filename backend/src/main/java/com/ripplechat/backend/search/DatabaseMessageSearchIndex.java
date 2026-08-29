package com.ripplechat.backend.search;

import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.message.MessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * PostgreSQL full-text fallback, active when {@code app.search.elasticsearch.enabled=false}.
 *
 * <p>This is the default: {@code docker-compose.yml} ships no Elasticsearch, so
 * search works out of the box on a fresh clone and on a single-instance
 * free-tier deployment. It reuses the existing {@code messages} full-text index
 * ({@code to_tsvector('simple', content)}, GIN-backed) and applies the same
 * sender, date and blocked-author filters as the Elasticsearch path, so the two
 * return the same rows. Ranking differs ({@code ts_rank} rather than BM25), and
 * indexing is a no-op: PostgreSQL rows are themselves the searchable source.
 */
@Component
@ConditionalOnProperty(name = "app.search.elasticsearch.enabled", havingValue = "false")
@RequiredArgsConstructor
@Slf4j
public class DatabaseMessageSearchIndex implements MessageSearchIndex {

    private final MessageRepository messageRepository;

    /**
     * Sentinel for the "nobody is blocked" case. The query uses {@code not in
     * (:blockedUsernames)}, and PostgreSQL rejects an empty {@code in ()} at
     * parse time, so the list must never be empty. No username can be blank,
     * so this excludes nothing.
     */
    private static final String NO_BLOCKED_USERS = "";

    @Override
    public List<UUID> searchIds(List<String> channelIds, String query, String from, Instant since, List<String> blockedUsernames, int page, int size) {
        String tsquery = toPrefixTsQuery(query);
        if (tsquery.isBlank()) {
            return List.of();
        }
        try {
            List<UUID> channelUuids = channelIds.stream().map(UUID::fromString).toList();
            // Match-everything defaults rather than nulls, so the SQL needs no
            // null casts. Sender matching is a substring, mirroring the
            // Elasticsearch path's Criteria.contains().
            String senderLike = from == null || from.isBlank()
                    ? "%"
                    : "%" + from.trim().toLowerCase().replaceAll("([%_\\\\])", "\\\\$1") + "%";
            Instant sinceOrEpoch = since == null ? Instant.EPOCH : since;
            List<String> blocked = blockedUsernames == null || blockedUsernames.isEmpty()
                    ? List.of(NO_BLOCKED_USERS)
                    : blockedUsernames;
            return messageRepository.searchMessageIdsFiltered(
                    channelUuids, tsquery, senderLike, sinceOrEpoch, blocked, PageRequest.of(page, size));
        } catch (Exception e) {
            log.warn("PostgreSQL fallback search failed for query '{}'", query, e);
            return List.of();
        }
    }

    /** The messages table is the search source, so there is nothing to keep in step. */
    @Override
    public boolean requiresIndexing() {
        return false;
    }

    @Override
    public void index(Message message) {
        // No-op: with Elasticsearch disabled, the messages table is the search source.
    }

    @Override
    public void delete(UUID messageId) {
        // No-op: see index().
    }

    /**
     * Turns a raw user query into a prefix {@code to_tsquery} string
     * (e.g. {@code "hello wor"} → {@code "hello:* & wor:*"}). Each token is
     * stripped to letters/digits so user input can never inject tsquery operators.
     */
    private static String toPrefixTsQuery(String query) {
        if (query == null || query.isBlank()) {
            return "";
        }
        return Arrays.stream(query.trim().split("\\s+"))
                .map(token -> token.replaceAll("[^\\p{L}\\p{N}]", ""))
                .filter(token -> !token.isEmpty())
                .map(token -> token + ":*")
                .collect(Collectors.joining(" & "));
    }
}
