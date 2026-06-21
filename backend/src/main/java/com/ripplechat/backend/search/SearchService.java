package com.ripplechat.backend.search;

import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.message.MessageRepository;
import com.ripplechat.backend.search.dto.SearchPageResponse;
import com.ripplechat.backend.search.dto.SearchResultResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SearchService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 50;

    private final ChannelMembershipRepository membershipRepository;
    private final MessageRepository messageRepository;

    @Transactional(readOnly = true)
    public List<SearchResultResponse> searchMessages(String username, String query) {
        return searchMessages(username, query, null, null, null);
    }

    /**
     * Convenience overload returning the first page as a flat list (used by the
     * simpler call sites and tests).
     */
    @Transactional(readOnly = true)
    public List<SearchResultResponse> searchMessages(String username, String query, UUID channelId,
                                                     String from, Instant since) {
        return searchPage(username, query, channelId, from, since, 0, MAX_PAGE_SIZE).results();
    }

    /**
     * Full-text search with optional filters: a single channel, a sender (matched
     * on username/display name), and a "since" date. The FTS ranking is paged in
     * one indexed query; sender/date filters are applied to the ranked page.
     * {@code hasMore} reflects the raw ranked page so paging stays reliable even
     * when the post-filters hide some hits.
     */
    @Transactional(readOnly = true)
    public SearchPageResponse searchPage(String username, String query, UUID channelId,
                                         String from, Instant since, int page, int size) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageNumber = Math.max(page, 0);

        String tsquery = toPrefixTsQuery(query);
        if (tsquery.isEmpty()) {
            return new SearchPageResponse(List.of(), false);
        }
        List<UUID> channelIds;
        if (channelId != null) {
            if (!membershipRepository.existsByChannelIdAndUser_Username(channelId, username)) {
                return new SearchPageResponse(List.of(), false);
            }
            channelIds = List.of(channelId);
        } else {
            channelIds = membershipRepository.findByUser_Username(username).stream()
                    .map(m -> m.getChannel().getId())
                    .toList();
        }
        if (channelIds.isEmpty()) {
            return new SearchPageResponse(List.of(), false);
        }

        List<UUID> rankedIds = messageRepository.searchMessageIds(
                channelIds, tsquery, PageRequest.of(pageNumber, pageSize));
        boolean hasMore = rankedIds.size() == pageSize;
        if (rankedIds.isEmpty()) {
            return new SearchPageResponse(List.of(), false);
        }
        Map<UUID, Message> byId = messageRepository.findForSearchByIds(rankedIds).stream()
                .collect(Collectors.toMap(Message::getId, Function.identity()));
        String fromLower = (from == null || from.isBlank()) ? null : from.trim().toLowerCase();
        List<SearchResultResponse> results = rankedIds.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .filter(m -> fromLower == null || matchesSender(m, fromLower))
                .filter(m -> since == null || !m.getCreatedAt().isBefore(since))
                .map(SearchResultResponse::from)
                .toList();
        return new SearchPageResponse(results, hasMore);
    }

    private boolean matchesSender(Message message, String fromLower) {
        String username = message.getSender().getUsername().toLowerCase();
        String display = message.getSender().getDisplayName() == null
                ? "" : message.getSender().getDisplayName().toLowerCase();
        return username.contains(fromLower) || display.contains(fromLower);
    }

    /**
     * Builds a prefix tsquery from free-text input: each whitespace-separated
     * term is stripped to letters/digits and matched as a prefix ({@code term:*}),
     * all ANDed together. Returns "" when the input has no searchable terms.
     */
    private String toPrefixTsQuery(String query) {
        if (query == null || query.isBlank()) {
            return "";
        }
        return Arrays.stream(query.trim().split("\\s+"))
                .map(term -> term.replaceAll("[^\\p{L}\\p{Nd}]", ""))
                .filter(term -> !term.isEmpty())
                .map(term -> term + ":*")
                .collect(Collectors.joining(" & "));
    }
}
