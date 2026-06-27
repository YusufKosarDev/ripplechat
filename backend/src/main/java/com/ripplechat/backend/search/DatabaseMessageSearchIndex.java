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
 * <p>Lets the app boot and serve search when no Elasticsearch is available
 * (e.g. a single-instance free-tier deployment). It reuses the existing
 * {@code messages} full-text index ({@code to_tsvector('simple', content)}, GIN-backed),
 * so results are real — only the secondary sender/date filters are dropped.
 * Indexing is a no-op: PostgreSQL rows are themselves the searchable source.
 */
@Component
@ConditionalOnProperty(name = "app.search.elasticsearch.enabled", havingValue = "false")
@RequiredArgsConstructor
@Slf4j
public class DatabaseMessageSearchIndex implements MessageSearchIndex {

    private final MessageRepository messageRepository;

    @Override
    public List<UUID> searchIds(List<String> channelIds, String query, String from, Instant since, int page, int size) {
        String tsquery = toPrefixTsQuery(query);
        if (tsquery.isBlank()) {
            return List.of();
        }
        try {
            List<UUID> channelUuids = channelIds.stream().map(UUID::fromString).toList();
            return messageRepository.searchMessageIds(channelUuids, tsquery, PageRequest.of(page, size));
        } catch (Exception e) {
            log.warn("PostgreSQL fallback search failed for query '{}'", query, e);
            return List.of();
        }
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
