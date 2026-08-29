package com.ripplechat.backend.search;

import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.message.MessageRepository;
import com.ripplechat.backend.outbox.OutboxTask;
import com.ripplechat.backend.outbox.OutboxTaskRepository;
import com.ripplechat.backend.outbox.OutboxTaskTypes;
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
    private final OutboxTaskRepository outboxTaskRepository;

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

        User viewer = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
        List<UUID> blockedIds = blockRepository.findByBlockerId(viewer.getId()).stream()
                .map(UserBlock::getBlockedId)
                .toList();
        List<String> blockedUsernames = userRepository.findAllById(blockedIds).stream()
                .map(User::getUsername)
                .toList();

        List<UUID> rankedIds = searchIndex.searchIds(channelIds, query, from, since, blockedUsernames, pageNumber, pageSize);

        if (rankedIds.isEmpty()) {
            return new SearchPageResponse(List.of(), false);
        }

        boolean hasMore = rankedIds.size() == pageSize; // simplistic

        Map<UUID, Message> byId = messageRepository.findForSearchByIdsFiltered(rankedIds, viewer.getId()).stream()
                .collect(Collectors.toMap(Message::getId, Function.identity()));

        List<SearchResultResponse> results = rankedIds.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .map(SearchResultResponse::from)
                .toList();

        return new SearchPageResponse(results, hasMore);
    }

    /**
     * Indexes a message, and makes sure it happens even if this attempt does not.
     *
     * <p>The attempt is inline because search has to be fresh: a message you just
     * sent should be findable now, not on the next sweep. What was missing is
     * what happens when the attempt fails — the Elasticsearch adapter caught its
     * own exceptions and logged them, so a few seconds of the cluster being
     * unreachable meant a message was silently never searchable, with nothing
     * anywhere that would try again. A failure now goes on the transactional
     * outbox, which retries with backoff and gives up visibly.
     *
     * <p>Skipped entirely on the PostgreSQL backend, where the rows are the index.
     */
    public void indexMessage(Message message) {
        if (!searchIndex.requiresIndexing()) {
            return;
        }
        try {
            searchIndex.index(message);
        } catch (RuntimeException e) {
            log.warn("Could not index message {} — queued for retry", message.getId(), e);
            enqueue(OutboxTaskTypes.INDEX_MESSAGE, message.getId());
        }
    }

    /**
     * Removes a message from the index, with the same retry.
     *
     * <p>This is the direction that matters most: a failed index means a message
     * cannot be found, while a failed delete means deleted content stays
     * findable — which is the thing deleting it was for.
     */
    public void deleteMessage(UUID messageId) {
        if (!searchIndex.requiresIndexing()) {
            return;
        }
        try {
            searchIndex.delete(messageId);
        } catch (RuntimeException e) {
            log.warn("Could not remove message {} from the index — queued for retry", messageId, e);
            enqueue(OutboxTaskTypes.REMOVE_FROM_SEARCH_INDEX, messageId);
        }
    }

    private void enqueue(String taskType, UUID messageId) {
        OutboxTask task = new OutboxTask();
        task.setId(UUID.randomUUID());
        task.setTaskType(taskType);
        task.setPayload(messageId.toString());
        task.setStatus(OutboxTask.Status.PENDING);
        task.setCreatedAt(Instant.now());
        outboxTaskRepository.save(task);
    }

    /**
     * Retries a queued index, called by the outbox processor.
     *
     * <p>A message that has since been deleted, or removed outright, is taken out
     * of the index instead of being written into it: by the time a retry runs,
     * the message it names may not be the message it was queued for.
     */
    @Transactional(readOnly = true)
    public void applyIndex(UUID messageId) {
        messageRepository.findById(messageId)
                .filter(message -> !message.isDeleted())
                .ifPresentOrElse(searchIndex::index, () -> searchIndex.delete(messageId));
    }

    /** Retries a queued removal, called by the outbox processor. */
    public void applyDelete(UUID messageId) {
        searchIndex.delete(messageId);
    }
}
