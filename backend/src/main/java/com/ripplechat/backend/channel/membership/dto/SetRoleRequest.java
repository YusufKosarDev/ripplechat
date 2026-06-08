package com.ripplechat.backend.channel.membership.dto;

import com.ripplechat.backend.channel.membership.MembershipRole;

public record SetRoleRequest(
        MembershipRole role
) {
}
