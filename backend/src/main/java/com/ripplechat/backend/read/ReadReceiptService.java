package com.ripplechat.backend.read;

import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.read.dto.ReadReceipt;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReadReceiptService {

    private final ChannelReadRepository readRepository;
    private final ChannelMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /** Marks the channel read up to now for the user and broadcasts the receipt. */
    @Transactional
    public void markRead(UUID channelId, String username) {
        requireMember(channelId, username);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        Instant now = Instant.now();
        ChannelRead read = readRepository.findByChannelIdAndUserId(channelId, user.getId())
                .orElseGet(() -> {
                    ChannelRead r = new ChannelRead();
                    r.setChannelId(channelId);
                    r.setUserId(user.getId());
                    return r;
                });
        read.setLastReadAt(now);
        readRepository.save(read);

        messagingTemplate.convertAndSend(
                "/topic/channels/" + channelId + "/reads", new ReadReceipt(channelId, user.getId(), now));
    }

    /** Read positions of all members in the channel (to render receipts on load). */
    @Transactional(readOnly = true)
    public List<ReadReceipt> listReads(UUID channelId, String username) {
        requireMember(channelId, username);
        return readRepository.findByChannelId(channelId).stream()
                .map(r -> new ReadReceipt(channelId, r.getUserId(), r.getLastReadAt()))
                .toList();
    }

    private void requireMember(UUID channelId, String username) {
        if (!membershipRepository.existsByChannelIdAndUser_Username(channelId, username)) {
            throw new ForbiddenException("not a member of channel: " + channelId);
        }
    }
}
