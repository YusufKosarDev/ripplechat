package com.ripplechat.backend.channel.membership;

import com.ripplechat.backend.common.exception.ForbiddenException;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Reusable channel-membership check. Extracted so the several services that gate
 * on membership share one guard instead of each repeating the repository lookup.
 */
@Component
public class ChannelMembershipGuard {

    private final ChannelMembershipRepository membershipRepository;

    public ChannelMembershipGuard(ChannelMembershipRepository membershipRepository) {
        this.membershipRepository = membershipRepository;
    }

    /** Throws {@link ForbiddenException} unless {@code username} is a member of the channel. */
    public void requireMember(UUID channelId, String username) {
        if (!membershipRepository.existsByChannelIdAndUser_Username(channelId, username)) {
            throw new ForbiddenException("not a member of channel: " + channelId);
        }
    }
}
