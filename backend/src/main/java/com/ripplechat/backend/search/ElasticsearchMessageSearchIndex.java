package com.ripplechat.backend.search;

import com.ripplechat.backend.message.Message;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.query.Criteria;
import org.springframework.data.elasticsearch.core.query.CriteriaQuery;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Elasticsearch-backed search. Active by default; switched off by setting
 * {@code app.search.elasticsearch.enabled=false} (which then activates
 * {@link DatabaseMessageSearchIndex} instead).
 */
@Component
@ConditionalOnProperty(name = "app.search.elasticsearch.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
@Slf4j
public class ElasticsearchMessageSearchIndex implements MessageSearchIndex {

    private final MessageSearchRepository searchRepository;
    private final ElasticsearchOperations elasticsearchOperations;

    @Override
    public List<UUID> searchIds(List<String> channelIds, String query, String from, Instant since, List<String> blockedUsernames, int page, int size) {
        Criteria criteria = new Criteria("content").matches(query)
                .and(new Criteria("channelId").in(channelIds));

        if (from != null && !from.isBlank()) {
            criteria = criteria.and(new Criteria("senderUsername").contains(from.trim().toLowerCase()));
        }
        if (since != null) {
            criteria = criteria.and(new Criteria("createdAt").greaterThanEqual(since.toEpochMilli()));
        }
        if (blockedUsernames != null && !blockedUsernames.isEmpty()) {
            criteria = criteria.and(new Criteria("senderUsername").in(blockedUsernames).not());
        }

        CriteriaQuery criteriaQuery = new CriteriaQuery(criteria)
                .setPageable(PageRequest.of(page, size));

        SearchHits<MessageDocument> searchHits = elasticsearchOperations.search(criteriaQuery, MessageDocument.class);

        return searchHits.getSearchHits().stream()
                .map(SearchHit::getContent)
                .map(doc -> UUID.fromString(doc.getId()))
                .toList();
    }

    @Override
    public void index(Message message) {
        try {
            MessageDocument doc = MessageDocument.builder()
                    .id(message.getId().toString())
                    .channelId(message.getChannel().getId().toString())
                    .content(message.getContent() == null ? "" : message.getContent())
                    .senderUsername(message.getSender().getUsername())
                    .createdAt(message.getCreatedAt())
                    .build();
            searchRepository.save(doc);
        } catch (Exception e) {
            log.error("Failed to index message to Elasticsearch", e);
        }
    }

    @Override
    public void delete(UUID messageId) {
        try {
            searchRepository.deleteById(messageId.toString());
        } catch (Exception e) {
            log.error("Failed to delete message from Elasticsearch", e);
        }
    }
}
