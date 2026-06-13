package com.ripplechat.backend.channel;

import com.ripplechat.backend.channel.dto.DirectChannelResponse;
import com.ripplechat.backend.channel.membership.ChannelMembership;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.channel.membership.MembershipRole;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Opens and lists one-to-one direct messages. A DM is a private {@link Channel}
 * of type DIRECT with two members; a stable {@code dmKey} keeps a user pair to a
 * single conversation.
 */
@Service
@RequiredArgsConstructor
public class DirectMessageService {

    private final ChannelRepository channelRepository;
    private final ChannelMembershipRepository membershipRepository;
    private final UserRepository userRepository;

    /** Returns the existing DM with the other user, creating it on first contact. */
    @Transactional
    public DirectChannelResponse openOrCreate(String username, UUID otherUserId) {
        User me = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
        if (me.getId().equals(otherUserId)) {
            throw new BadRequestException("cannot start a direct message with yourself");
        }
        User other = userRepository.findById(otherUserId)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + otherUserId));

        String key = dmKey(me.getId(), other.getId());
        Channel channel = channelRepository.findByDmKey(key).orElseGet(() -> createDm(me, other, key));
        return DirectChannelResponse.of(channel, other);
    }

    /** The current user's direct messages, newest first, each with the other participant. */
    @Transactional(readOnly = true)
    public List<DirectChannelResponse> listForUser(String username) {
        return membershipRepository.findByUser_Username(username).stream()
                .map(ChannelMembership::getChannel)
                .filter(c -> c.getType() == ChannelType.DIRECT && !c.isDeleted())
                .sorted(Comparator.comparing(Channel::getCreatedAt).reversed())
                .map(c -> DirectChannelResponse.of(c, otherParticipant(c, username)))
                .toList();
    }

    private Channel createDm(User me, User other, String key) {
        Channel channel = new Channel();
        channel.setName(me.getUsername() + " ↔ " + other.getUsername());
        channel.setPrivate(true);
        channel.setType(ChannelType.DIRECT);
        channel.setDmKey(key);
        channel.setCreatedBy(me);
        Channel saved = channelRepository.saveAndFlush(channel);
        addMember(saved, me);
        addMember(saved, other);
        return saved;
    }

    private void addMember(Channel channel, User user) {
        ChannelMembership membership = new ChannelMembership();
        membership.setChannel(channel);
        membership.setUser(user);
        membership.setRole(MembershipRole.MEMBER);
        membershipRepository.save(membership);
    }

    private User otherParticipant(Channel channel, String username) {
        return membershipRepository.findByChannelId(channel.getId()).stream()
                .map(ChannelMembership::getUser)
                .filter(u -> !u.getUsername().equals(username))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("direct message participant missing"));
    }

    /** Order-independent key so (a,b) and (b,a) map to the same conversation. */
    private String dmKey(UUID a, UUID b) {
        return a.compareTo(b) <= 0 ? a + ":" + b : b + ":" + a;
    }
}
