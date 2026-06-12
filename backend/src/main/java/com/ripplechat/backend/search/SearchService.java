package com.ripplechat.backend.search;

import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.message.MessageRepository;
import com.ripplechat.backend.search.dto.SearchResultResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    private static final int LIMIT = 50;

    private final ChannelMembershipRepository membershipRepository;
    private final MessageRepository messageRepository;

    @Transactional(readOnly = true)
    public List<SearchResultResponse> searchMessages(String username, String query) {
        String tsquery = toPrefixTsQuery(query);
        if (tsquery.isEmpty()) {
            return List.of();
        }
        List<UUID> channelIds = membershipRepository.findByUser_Username(username).stream()
                .map(m -> m.getChannel().getId())
                .toList();
        if (channelIds.isEmpty()) {
            return List.of();
        }

        // Two steps so the FTS ranking happens in one indexed native query, then
        // the (≤50) rows are fetch-joined without N+1 and re-ordered by rank.
        List<UUID> rankedIds = messageRepository.searchMessageIds(channelIds, tsquery, PageRequest.of(0, LIMIT));
        if (rankedIds.isEmpty()) {
            return List.of();
        }
        Map<UUID, Message> byId = messageRepository.findForSearchByIds(rankedIds).stream()
                .collect(Collectors.toMap(Message::getId, Function.identity()));
        return rankedIds.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .map(SearchResultResponse::from)
                .toList();
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
