package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.common.dto.PageResponse;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final ChannelRepository channelRepository;
    private final UserRepository userRepository;
    private final ChannelMembershipRepository membershipRepository;

    @Transactional
    public MessageResponse send(UUID channelId, CreateMessageRequest request, String username) {
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("channel not found: " + channelId));
        requireMember(channelId, username);

        User sender = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        Message message = new Message();
        message.setContent(request.content());
        message.setChannel(channel);
        message.setSender(sender);

        return MessageResponse.from(messageRepository.saveAndFlush(message));
    }

    @Transactional(readOnly = true)
    public PageResponse<MessageResponse> findByChannel(UUID channelId, String username, Pageable pageable) {
        if (!channelRepository.existsById(channelId)) {
            throw new ResourceNotFoundException("channel not found: " + channelId);
        }
        requireMember(channelId, username);
        return PageResponse.from(
                messageRepository.findByChannelId(channelId, pageable).map(MessageResponse::from));
    }

    private void requireMember(UUID channelId, String username) {
        if (!membershipRepository.existsByChannelIdAndUser_Username(channelId, username)) {
            throw new ForbiddenException("not a member of channel: " + channelId);
        }
    }
}
