package com.ripplechat.backend.channel.membership;

import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.channel.membership.dto.MemberResponse;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChannelMembershipService {

    private final ChannelMembershipRepository membershipRepository;
    private final ChannelRepository channelRepository;
    private final UserRepository userRepository;

    /**
     * Adds the channel creator as OWNER. Called when a channel is created.
     */
    @Transactional
    public void addOwner(Channel channel, User user) {
        ChannelMembership membership = new ChannelMembership();
        membership.setChannel(channel);
        membership.setUser(user);
        membership.setRole(MembershipRole.OWNER);
        membershipRepository.save(membership);
    }

    @Transactional
    public MemberResponse join(UUID channelId, String username) {
        return membershipRepository.findByChannelIdAndUser_Username(channelId, username)
                .map(MemberResponse::from) // already a member -> idempotent
                .orElseGet(() -> {
                    Channel channel = getChannel(channelId);
                    User user = getUser(username);
                    ChannelMembership membership = new ChannelMembership();
                    membership.setChannel(channel);
                    membership.setUser(user);
                    membership.setRole(MembershipRole.MEMBER);
                    return MemberResponse.from(membershipRepository.saveAndFlush(membership));
                });
    }

    @Transactional
    public void leave(UUID channelId, String username) {
        ChannelMembership membership = membershipRepository.findByChannelIdAndUser_Username(channelId, username)
                .orElseThrow(() -> new ResourceNotFoundException("not a member of channel: " + channelId));

        if (membership.getRole() == MembershipRole.OWNER
                && membershipRepository.countByChannelId(channelId) > 1) {
            throw new ForbiddenException("owner cannot leave while the channel has other members");
        }
        membershipRepository.delete(membership);
    }

    @Transactional(readOnly = true)
    public List<MemberResponse> listMembers(UUID channelId) {
        requireChannelExists(channelId);
        return membershipRepository.findByChannelId(channelId).stream()
                .map(MemberResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean isMember(UUID channelId, String username) {
        return membershipRepository.existsByChannelIdAndUser_Username(channelId, username);
    }

    private void requireChannelExists(UUID channelId) {
        if (!channelRepository.existsById(channelId)) {
            throw new ResourceNotFoundException("channel not found: " + channelId);
        }
    }

    private Channel getChannel(UUID channelId) {
        return channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("channel not found: " + channelId));
    }

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
    }
}
