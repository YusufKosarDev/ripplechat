package com.ripplechat.backend.channel;

import com.ripplechat.backend.channel.dto.ChannelDeletedEvent;
import com.ripplechat.backend.channel.dto.ChannelResponse;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.channel.dto.UpdateChannelRequest;
import com.ripplechat.backend.channel.membership.ChannelMembership;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.channel.membership.MembershipRole;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChannelService {

    private final ChannelRepository channelRepository;
    private final UserRepository userRepository;
    private final ChannelMembershipRepository membershipRepository;
    private final ChannelMembershipService membershipService;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public ChannelResponse create(CreateChannelRequest request, String username) {
        User creator = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        Channel channel = new Channel();
        channel.setName(request.name());
        channel.setDescription(request.description());
        channel.setPrivate(Boolean.TRUE.equals(request.isPrivate()));
        channel.setCreatedBy(creator);

        Channel saved = channelRepository.saveAndFlush(channel);
        membershipService.addOwner(saved, creator);
        return ChannelResponse.from(saved);
    }

    /**
     * Public channels are visible to everyone; private channels only to members.
     */
    @Transactional(readOnly = true)
    public List<ChannelResponse> findAll(String username) {
        Set<UUID> memberChannelIds = membershipRepository.findByUser_Username(username).stream()
                .map(membership -> membership.getChannel().getId())
                .collect(Collectors.toSet());

        return channelRepository.findAll().stream()
                .filter(channel -> !channel.isDeleted())
                .filter(channel -> !channel.isPrivate() || memberChannelIds.contains(channel.getId()))
                .map(ChannelResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ChannelResponse findById(UUID id, String username) {
        Channel channel = getActiveChannel(id);
        if (channel.isPrivate() && !membershipRepository.existsByChannelIdAndUser_Username(id, username)) {
            throw new ForbiddenException("not a member of private channel: " + id);
        }
        return ChannelResponse.from(channel);
    }

    @Transactional
    public ChannelResponse update(UUID channelId, String username, UpdateChannelRequest request) {
        Channel channel = getActiveChannel(channelId);
        requireOwner(channelId, username);
        channel.setName(request.name().trim());
        channel.setDescription(request.description());
        return ChannelResponse.from(channelRepository.saveAndFlush(channel));
    }

    @Transactional
    public void delete(UUID channelId, String username) {
        Channel channel = getActiveChannel(channelId);
        requireOwner(channelId, username);
        channel.setDeleted(true);
        channelRepository.saveAndFlush(channel);
        messagingTemplate.convertAndSend(
                "/topic/channels/" + channelId + "/deleted", new ChannelDeletedEvent(channelId));
    }

    private Channel getActiveChannel(UUID id) {
        Channel channel = channelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("channel not found: " + id));
        if (channel.isDeleted()) {
            throw new ResourceNotFoundException("channel not found: " + id);
        }
        return channel;
    }

    private void requireOwner(UUID channelId, String username) {
        MembershipRole role = membershipRepository.findByChannelIdAndUser_Username(channelId, username)
                .map(ChannelMembership::getRole)
                .orElse(null);
        if (role != MembershipRole.OWNER) {
            throw new ForbiddenException("only the channel owner can do this");
        }
    }
}
