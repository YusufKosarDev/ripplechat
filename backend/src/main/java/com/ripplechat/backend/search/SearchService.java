package com.ripplechat.backend.search;

import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.message.MessageRepository;
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

    private static final int LIMIT = 50;

    private final ChannelMembershipRepository membershipRepository;
    private final MessageRepository messageRepository;

    @Transactional(readOnly = true)
    public List<SearchResultResponse> searchMessages(String username, String query) {
        return searchMessages(username, query, null, null, null);
    }

    /**
     * Full-text search with optional filters: a single channel, a sender (matched
     * on username/display name), and a "since" date. The FTS ranking is done in
     * one indexed query; sender/date filters are applied to the (≤50) ranked rows.
     */
    @Transactional(readOnly = true)
    public List<SearchResultResponse> searchMessages(String username, String query, UUID channelId,
                                                     String from, Instant since) {
        String tsquery = toPrefixTsQuery(query);
        if (tsquery.isEmpty()) {
            return List.of();
        }
        List<UUID> channelIds;
        if (channelId != null) {
            if (!membershipRepository.existsByChannelIdAndUser_Username(channelId, username)) {
                return List.of();
            }
            channelIds = List.of(channelId);
        } else {
            channelIds = membershipRepository.findByUser_Username(username).stream()
                    .map(m -> m.getChannel().getId())
                    .toList();
        }
        if (channelIds.isEmpty()) {
            return List.of();
        }

        List<UUID> rankedIds = messageRepository.searchMessageIds(channelIds, tsquery, PageRequest.of(0, LIMIT));
        if (rankedIds.isEmpty()) {
            return List.of();
        }
        Map<UUID, Message> byId = messageRepository.findForSearchByIds(rankedIds).stream()
                .collect(Collectors.toMap(Message::getId, Function.identity()));
        String fromLower = (from == null || from.isBlank()) ? null : from.trim().toLowerCase();
        return rankedIds.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .filter(m -> fromLower == null || matchesSender(m, fromLower))
                .filter(m -> since == null || !m.getCreatedAt().isBefore(since))
                .map(SearchResultResponse::from)
                .toList();
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
