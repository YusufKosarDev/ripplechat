package com.ripplechat.backend.search;

import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.message.MessageRepository;
import com.ripplechat.backend.search.dto.SearchPageResponse;
import com.ripplechat.backend.search.dto.SearchResultResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.query.Criteria;
import org.springframework.data.elasticsearch.core.query.CriteriaQuery;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SearchService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 50;

    private final ChannelMembershipRepository membershipRepository;
    private final MessageRepository messageRepository;
    private final MessageSearchRepository searchRepository;
    private final ElasticsearchOperations elasticsearchOperations;

    @Transactional(readOnly = true)
    public List<SearchResultResponse> searchMessages(String username, String query) {
        return searchPage(username, query, null, null, null, 0, MAX_PAGE_SIZE).results();
    }

    @Transactional(readOnly = true)
    public SearchPageResponse searchPage(String username, String query, UUID channelId,
                                         String from, Instant since, int page, int size) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageNumber = Math.max(page, 0);

        if (query == null || query.isBlank()) {
            return new SearchPageResponse(List.of(), false);
        }

        List<String> channelIds;
        if (channelId != null) {
            if (!membershipRepository.existsByChannelIdAndUser_Username(channelId, username)) {
                return new SearchPageResponse(List.of(), false);
            }
            channelIds = List.of(channelId.toString());
        } else {
            channelIds = membershipRepository.findByUser_Username(username).stream()
                    .map(m -> m.getChannel().getId().toString())
                    .toList();
        }

        if (channelIds.isEmpty()) {
            return new SearchPageResponse(List.of(), false);
        }

        Criteria criteria = new Criteria("content").matches(query)
                .and(new Criteria("channelId").in(channelIds));

        if (from != null && !from.isBlank()) {
            // Note: Since senderUsername is Keyword in our ES mapping, we might need a partial match or precise match.
            // But we use "contains" logic. We can do contains on the string if we map it as text.
            // For simplicity, we just filter it post-ES if we want, or use matches.
            criteria = criteria.and(new Criteria("senderUsername").contains(from.trim().toLowerCase()));
        }

        if (since != null) {
            criteria = criteria.and(new Criteria("createdAt").greaterThanEqual(since.toEpochMilli()));
        }

        CriteriaQuery criteriaQuery = new CriteriaQuery(criteria)
                .setPageable(PageRequest.of(pageNumber, pageSize));

        SearchHits<MessageDocument> searchHits = elasticsearchOperations.search(criteriaQuery, MessageDocument.class);
        
        List<UUID> rankedIds = searchHits.getSearchHits().stream()
                .map(SearchHit::getContent)
                .map(doc -> UUID.fromString(doc.getId()))
                .toList();

        boolean hasMore = rankedIds.size() == pageSize; // simplistic

        if (rankedIds.isEmpty()) {
            return new SearchPageResponse(List.of(), false);
        }

        Map<UUID, Message> byId = messageRepository.findForSearchByIds(rankedIds).stream()
                .collect(Collectors.toMap(Message::getId, Function.identity()));

        List<SearchResultResponse> results = rankedIds.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .map(SearchResultResponse::from)
                .toList();

        return new SearchPageResponse(results, hasMore);
    }

    public void indexMessage(Message message) {
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

    public void deleteMessage(UUID messageId) {
        try {
            searchRepository.deleteById(messageId.toString());
        } catch (Exception e) {
            log.error("Failed to delete message from Elasticsearch", e);
        }
    }
}
