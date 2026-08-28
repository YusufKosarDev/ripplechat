package com.ripplechat.backend.channel.membership;

import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.channel.ChannelType;
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
    private final ChannelMembershipGuard membershipGuard;

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

    /**
     * Self-service join, for public channels only.
     *
     * <p>This used to admit anyone who knew a channel id, whatever the channel
     * was. That made the id the only thing standing between an outsider and a
     * private channel — or a direct message, which is a private channel too — and
     * membership is what every other read is gated on, so joining handed over the
     * whole conversation: history, live feed, search, and the ability to post.
     * A private channel is joined by being added ({@link #addMember}), never by
     * knowing where it is.
     */
    @Transactional
    public MemberResponse join(UUID channelId, String username) {
        return membershipRepository.findByChannelIdAndUser_Username(channelId, username)
                .map(MemberResponse::from) // already a member -> idempotent
                .orElseGet(() -> {
                    Channel channel = getActiveChannel(channelId);
                    if (channel.isPrivate() || channel.getType() != ChannelType.CHANNEL) {
                        throw new ForbiddenException("this channel is invite-only: " + channelId);
                    }
                    User user = getUser(username);
                    ChannelMembership membership = new ChannelMembership();
                    membership.setChannel(channel);
                    membership.setUser(user);
                    membership.setRole(MembershipRole.MEMBER);
                    return MemberResponse.from(membershipRepository.saveAndFlush(membership));
                });
    }

    /**
     * Adds someone else to a channel — the counterpart to {@link #join} now that
     * joining is public-only. Without this a private channel could only ever hold
     * the person who created it.
     *
     * <p>Restricted to owners and moderators, and to regular channels: a DM or
     * group DM has a membership its participants understand to be closed, and
     * widening it from here would do so silently.
     */
    @Transactional
    public MemberResponse addMember(UUID channelId, String actorUsername, UUID targetUserId) {
        Channel channel = getActiveChannel(channelId);
        if (channel.getType() != ChannelType.CHANNEL) {
            throw new ForbiddenException("direct messages cannot take new members");
        }
        requireModerator(channelId, actorUsername);

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + targetUserId));
        if (target.isDeleted()) {
            // An erased account is indistinguishable from one that never existed.
            throw new ResourceNotFoundException("user not found: " + targetUserId);
        }

        return membershipRepository.findByChannelIdAndUser_Id(channelId, targetUserId)
                .map(MemberResponse::from) // already a member -> idempotent
                .orElseGet(() -> {
                    ChannelMembership membership = new ChannelMembership();
                    membership.setChannel(channel);
                    membership.setUser(target);
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

    /**
     * The channel's roster.
     *
     * <p>A public channel's members are part of browsing it — the join screen
     * shows who is already there before you commit — so no membership is
     * required. A private channel's roster is not public information, and
     * neither is a DM's: this endpoint had no check at all, so anyone holding a
     * channel id could enumerate the participants of a private conversation.
     */
    @Transactional(readOnly = true)
    public List<MemberResponse> listMembers(UUID channelId, String username) {
        Channel channel = getChannel(channelId);
        if (channel.isPrivate()) {
            membershipGuard.requireMember(channelId, username);
        }
        return membershipRepository.findByChannelId(channelId).stream()
                .map(MemberResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean isMember(UUID channelId, String username) {
        return membershipRepository.existsByChannelIdAndUser_Username(channelId, username);
    }

    @Transactional(readOnly = true)
    public MembershipRole roleOf(UUID channelId, String username) {
        return membershipRepository.findByChannelIdAndUser_Username(channelId, username)
                .map(ChannelMembership::getRole)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public boolean canModerate(UUID channelId, String username) {
        MembershipRole role = roleOf(channelId, username);
        return role != null && role.canModerate();
    }

    /** OWNER kicks a member. Cannot kick yourself or the owner. */
    @Transactional
    public void kick(UUID channelId, String actorUsername, UUID targetUserId) {
        requireOwner(channelId, actorUsername);
        ChannelMembership target = membershipRepository.findByChannelIdAndUser_Id(channelId, targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("member not found"));
        if (target.getUser().getUsername().equals(actorUsername)) {
            throw new ForbiddenException("use leave to remove yourself");
        }
        if (target.getRole() == MembershipRole.OWNER) {
            throw new ForbiddenException("cannot remove the owner");
        }
        membershipRepository.delete(target);
    }

    /** OWNER promotes/demotes a member between MODERATOR and MEMBER. */
    @Transactional
    public MemberResponse setRole(UUID channelId, String actorUsername, UUID targetUserId, MembershipRole role) {
        requireOwner(channelId, actorUsername);
        if (role != MembershipRole.MODERATOR && role != MembershipRole.MEMBER) {
            throw new ForbiddenException("role can only be set to MODERATOR or MEMBER");
        }
        ChannelMembership target = membershipRepository.findByChannelIdAndUser_Id(channelId, targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("member not found"));
        if (target.getRole() == MembershipRole.OWNER) {
            throw new ForbiddenException("cannot change the owner's role");
        }
        target.setRole(role);
        return MemberResponse.from(membershipRepository.saveAndFlush(target));
    }

    private void requireOwner(UUID channelId, String username) {
        if (roleOf(channelId, username) != MembershipRole.OWNER) {
            throw new ForbiddenException("only the channel owner can do this");
        }
    }

    private void requireModerator(UUID channelId, String username) {
        if (!canModerate(channelId, username)) {
            throw new ForbiddenException("only channel owners/moderators can add members");
        }
    }

    private Channel getChannel(UUID channelId) {
        return channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("channel not found: " + channelId));
    }

    /** A soft-deleted channel is gone as far as membership changes are concerned. */
    private Channel getActiveChannel(UUID channelId) {
        Channel channel = getChannel(channelId);
        if (channel.isDeleted()) {
            throw new ResourceNotFoundException("channel not found: " + channelId);
        }
        return channel;
    }

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
    }
}
