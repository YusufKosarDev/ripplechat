package com.ripplechat.backend.channel;

import com.ripplechat.backend.channel.dto.DirectChannelResponse;
import com.ripplechat.backend.channel.membership.ChannelMembership;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.channel.membership.MembershipRole;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserBlockRepository;
import com.ripplechat.backend.user.UserRepository;
import com.ripplechat.backend.user.dto.UserSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
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
    private final UserBlockRepository blockRepository;

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

        if (blockRepository.existsByBlockerIdAndBlockedId(me.getId(), other.getId())
                || blockRepository.existsByBlockerIdAndBlockedId(other.getId(), me.getId())) {
            throw new ForbiddenException("cannot message a blocked user");
        }

        String key = dmKey(me.getId(), other.getId());
        Channel channel = channelRepository.findByDmKey(key).orElseGet(() -> createDm(me, other, key));
        return DirectChannelResponse.direct(channel, other);
    }

    /** Creates a multi-party group DM with the given other members and optional title. */
    @Transactional
    public DirectChannelResponse createGroup(String username, List<UUID> userIds, String name) {
        User me = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
        LinkedHashSet<UUID> ids = new LinkedHashSet<>(userIds == null ? List.of() : userIds);
        ids.remove(me.getId());
        if (ids.isEmpty()) {
            throw new BadRequestException("a group needs at least one other member");
        }
        List<User> others = userRepository.findAllById(ids);
        if (others.size() != ids.size()) {
            throw new ResourceNotFoundException("one or more users not found");
        }
        // Blocking already stops a one-to-one DM from being opened; a group was
        // the way around it, putting the two of them in the same conversation
        // anyway.
        for (User other : others) {
            if (blockRepository.existsByBlockerIdAndBlockedId(me.getId(), other.getId())
                    || blockRepository.existsByBlockerIdAndBlockedId(other.getId(), me.getId())) {
                throw new ForbiddenException("cannot add a blocked user to a group");
            }
        }

        Channel channel = new Channel();
        channel.setType(ChannelType.GROUP);
        channel.setPrivate(true);
        channel.setCreatedBy(me);
        channel.setName(groupName(name, me, others));
        Channel saved = channelRepository.saveAndFlush(channel);
        addMember(saved, me);
        for (User other : others) {
            addMember(saved, other);
        }
        return DirectChannelResponse.group(saved, participants(saved, username));
    }

    /** The current user's direct conversations (1:1 and groups), newest first. */
    @Transactional(readOnly = true)
    public List<DirectChannelResponse> listForUser(String username) {
        return membershipRepository.findByUser_Username(username).stream()
                .map(ChannelMembership::getChannel)
                .filter(c -> (c.getType() == ChannelType.DIRECT || c.getType() == ChannelType.GROUP) && !c.isDeleted())
                .sorted(Comparator.comparing(Channel::getCreatedAt).reversed())
                .map(c -> c.getType() == ChannelType.GROUP
                        ? DirectChannelResponse.group(c, participants(c, username))
                        : DirectChannelResponse.direct(c, otherParticipant(c, username)))
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

    /** The other members of a group (everyone except the viewer), as summaries. */
    private List<UserSummary> participants(Channel channel, String username) {
        return membershipRepository.findByChannelId(channel.getId()).stream()
                .map(ChannelMembership::getUser)
                .filter(u -> !u.getUsername().equals(username))
                .map(UserSummary::from)
                .toList();
    }

    private String groupName(String provided, User me, List<User> others) {
        String name;
        if (provided != null && !provided.isBlank()) {
            name = provided.trim();
        } else {
            List<String> names = new ArrayList<>();
            names.add(displayName(me));
            others.forEach(u -> names.add(displayName(u)));
            name = String.join(", ", names);
        }
        return name.length() > 100 ? name.substring(0, 100) : name;
    }

    private String displayName(User user) {
        return user.getDisplayName() != null ? user.getDisplayName() : user.getUsername();
    }

    /** Order-independent key so (a,b) and (b,a) map to the same conversation. */
    private String dmKey(UUID a, UUID b) {
        return a.compareTo(b) <= 0 ? a + ":" + b : b + ":" + a;
    }
}
