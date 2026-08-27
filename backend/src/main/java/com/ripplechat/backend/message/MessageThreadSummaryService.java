package com.ripplechat.backend.message;

import com.ripplechat.backend.message.dto.ThreadSummary;
import com.ripplechat.backend.user.UserRepository;
import com.ripplechat.backend.user.dto.UserSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Builds the "N replies, last repliers" summary shown on a message that starts a
 * thread.
 *
 * <p>Three unrelated callers need it — the channel feed, a freshly sent reply,
 * and {@link MessageBroadcastService} — so it stands on its own. The batch form
 * exists because the feed would otherwise issue a query per message; the single
 * form is a thin wrapper over it.
 */
@Service
@RequiredArgsConstructor
public class MessageThreadSummaryService {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;

    /** Batch form: one pair of queries for a whole page of messages, not per row. */
    @Transactional(readOnly = true)
    public Map<UUID, ThreadSummary> summariesByParent(List<UUID> parentIds) {
        if (parentIds.isEmpty()) {
            return Map.of();
        }

        Map<UUID, Integer> counts = messageRepository.findReplyCounts(parentIds).stream()
                .collect(Collectors.toMap(
                        row -> toUuid(row[0]),
                        row -> ((Number) row[1]).intValue()
                ));

        List<Object[]> replierRows = messageRepository.findLastReplierIds(parentIds);

        Set<UUID> senderIds = replierRows.stream()
                .map(row -> toUuid(row[1]))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<UUID, UserSummary> userSummaries = Map.of();
        if (!senderIds.isEmpty()) {
            userSummaries = userRepository.findAllById(senderIds).stream()
                    .map(UserSummary::from)
                    .collect(Collectors.toMap(UserSummary::id, Function.identity()));
        }

        Map<UUID, List<UserSummary>> repliersByParent = new HashMap<>();
        for (Object[] row : replierRows) {
            UUID parentId = toUuid(row[0]);
            UUID senderId = toUuid(row[1]);
            if (parentId != null && senderId != null) {
                UserSummary summary = userSummaries.get(senderId);
                if (summary != null) {
                    repliersByParent.computeIfAbsent(parentId, k -> new ArrayList<>()).add(summary);
                }
            }
        }

        Map<UUID, ThreadSummary> result = new HashMap<>();
        for (UUID parentId : parentIds) {
            int count = counts.getOrDefault(parentId, 0);
            List<UserSummary> repliers = repliersByParent.getOrDefault(parentId, List.of());
            result.put(parentId, new ThreadSummary(count, repliers));
        }
        return result;
    }

    /** Single-message form, for a send or an update broadcast. */
    @Transactional(readOnly = true)
    public ThreadSummary summaryFor(UUID parentId) {
        return summariesByParent(List.of(parentId)).getOrDefault(parentId, ThreadSummary.empty());
    }

    /** The native count/replier queries return the id column untyped across drivers. */
    private static UUID toUuid(Object obj) {
        if (obj instanceof UUID uuid) {
            return uuid;
        } else if (obj instanceof String s) {
            return UUID.fromString(s);
        } else if (obj != null) {
            return UUID.fromString(obj.toString());
        }
        return null;
    }
}
