package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.message.dto.MessageReactionUpdate;
import com.ripplechat.backend.message.dto.ReactionSummary;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MessageReactionService {

    private static final int MAX_EMOJI_LENGTH = 16;

    private final MessageReactionRepository reactionRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ChannelMembershipService membershipService;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public void toggle(UUID channelId, UUID messageId, String username, String emoji) {
        if (emoji == null || emoji.isBlank() || emoji.length() > MAX_EMOJI_LENGTH) {
            return;
        }
        if (!membershipService.isMember(channelId, username)) {
            throw new ForbiddenException("not a member of channel: " + channelId);
        }
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("message not found: " + messageId));
        if (!message.getChannel().getId().equals(channelId)) {
            throw new ResourceNotFoundException("message not found in channel: " + messageId);
        }

        reactionRepository.findByMessage_IdAndUser_UsernameAndEmoji(messageId, username, emoji)
                .ifPresentOrElse(
                        reactionRepository::delete,
                        () -> addReaction(message, username, emoji));
        reactionRepository.flush();

        List<ReactionSummary> summary = summarize(reactionRepository.findByMessage_Id(messageId));
        messagingTemplate.convertAndSend(
                "/topic/channels/" + channelId + "/message-reactions",
                new MessageReactionUpdate(messageId, summary));
    }

    private void addReaction(Message message, String username, String emoji) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
        MessageReaction reaction = new MessageReaction();
        reaction.setMessage(message);
        reaction.setUser(user);
        reaction.setEmoji(emoji);
        reactionRepository.save(reaction);
    }

    /** Reaction summaries grouped per message, for a page of messages. */
    @Transactional(readOnly = true)
    public Map<UUID, List<ReactionSummary>> summariesByMessage(Collection<UUID> messageIds) {
        if (messageIds.isEmpty()) {
            return Map.of();
        }
        return reactionRepository.findByMessage_IdIn(messageIds).stream()
                .collect(Collectors.groupingBy(r -> r.getMessage().getId()))
                .entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> summarize(e.getValue())));
    }

    private List<ReactionSummary> summarize(List<MessageReaction> reactions) {
        Map<String, List<MessageReaction>> byEmoji = reactions.stream()
                .collect(Collectors.groupingBy(MessageReaction::getEmoji, LinkedHashMap::new, Collectors.toList()));
        return byEmoji.entrySet().stream()
                .map(e -> new ReactionSummary(
                        e.getKey(),
                        e.getValue().size(),
                        e.getValue().stream().map(r -> r.getUser().getUsername()).toList()))
                .sorted(Comparator.comparingInt(ReactionSummary::count).reversed())
                .toList();
    }
}
