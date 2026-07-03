package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.membership.ChannelMembershipGuard;
import com.ripplechat.backend.message.dto.MediaItem;
import com.ripplechat.backend.message.dto.MessageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Read-only channel views over messages — the pinned list and the media gallery.
 * Split out from the mutation-heavy {@link MessageService} to keep that class
 * focused on writes/broadcasts. Both queries are membership-checked.
 */
@Service
@RequiredArgsConstructor
public class MessageQueryService {

    private final MessageRepository messageRepository;
    private final ChannelMembershipGuard membershipGuard;

    @Transactional(readOnly = true)
    public List<MessageResponse> listPinned(UUID channelId, String username) {
        membershipGuard.requireMember(channelId, username);
        return messageRepository.findByChannelIdAndPinnedTrueAndDeletedFalseOrderByCreatedAtDesc(channelId).stream()
                .map(MessageResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MediaItem> listMedia(UUID channelId, String username) {
        membershipGuard.requireMember(channelId, username);
        return messageRepository.findByChannelIdAndAttachmentUrlIsNotNullAndDeletedFalseOrderByCreatedAtDesc(channelId)
                .stream()
                .filter(m -> m.getAttachmentType() == null || "image".equals(m.getAttachmentType())) // images only
                .map(MediaItem::from)
                .toList();
    }
}
