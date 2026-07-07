package com.ripplechat.backend.search;

import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.message.MessageRepository;
import com.ripplechat.backend.search.dto.SearchPageResponse;
import com.ripplechat.backend.search.dto.SearchResultResponse;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import com.ripplechat.backend.user.UserBlock;
import com.ripplechat.backend.user.UserBlockRepository;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    private static final int MAX_PAGE_SIZE = 50;

    private final ChannelMembershipRepository membershipRepository;
    private final MessageRepository messageRepository;
    private final MessageSearchIndex searchIndex;
    private final UserRepository userRepository;
    private final UserBlockRepository blockRepository;

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

        List<UUID> rankedIds = searchIndex.searchIds(channelIds, query, from, since, pageNumber, pageSize);

        if (rankedIds.isEmpty()) {
            return new SearchPageResponse(List.of(), false);
        }

        boolean hasMore = rankedIds.size() == pageSize; // simplistic

        Map<UUID, Message> byId = messageRepository.findForSearchByIds(rankedIds).stream()
                .collect(Collectors.toMap(Message::getId, Function.identity()));

        User viewer = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
        List<UUID> blockedIds = blockRepository.findByBlockerId(viewer.getId()).stream()
                .map(UserBlock::getBlockedId)
                .toList();

        List<SearchResultResponse> results = rankedIds.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .filter(m -> !blockedIds.contains(m.getSender().getId()))
                .map(SearchResultResponse::from)
                .toList();

        return new SearchPageResponse(results, hasMore);
    }

    public void indexMessage(Message message) {
        searchIndex.index(message);
    }

    public void deleteMessage(UUID messageId) {
        searchIndex.delete(messageId);
    }
}
