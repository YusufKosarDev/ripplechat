package com.ripplechat.backend.search;

import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.message.MessageRepository;
import com.ripplechat.backend.search.dto.SearchResultResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SearchService {

    private static final int LIMIT = 50;

    private final ChannelMembershipRepository membershipRepository;
    private final MessageRepository messageRepository;

    @Transactional(readOnly = true)
    public List<SearchResultResponse> searchMessages(String username, String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        List<UUID> channelIds = membershipRepository.findByUser_Username(username).stream()
                .map(m -> m.getChannel().getId())
                .toList();
        if (channelIds.isEmpty()) {
            return List.of();
        }
        return messageRepository.search(channelIds, query.trim(), PageRequest.of(0, LIMIT)).stream()
                .map(SearchResultResponse::from)
                .toList();
    }
}
