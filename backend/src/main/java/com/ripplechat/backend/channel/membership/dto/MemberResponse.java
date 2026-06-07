package com.ripplechat.backend.channel.membership.dto;

import com.ripplechat.backend.channel.membership.ChannelMembership;
import com.ripplechat.backend.channel.membership.MembershipRole;
import com.ripplechat.backend.user.dto.UserSummary;

import java.time.Instant;

public record MemberResponse(
        UserSummary user,
        MembershipRole role,
        Instant joinedAt
) {
    public static MemberResponse from(ChannelMembership membership) {
        return new MemberResponse(
                UserSummary.from(membership.getUser()),
                membership.getRole(),
                membership.getJoinedAt()
        );
    }
}
