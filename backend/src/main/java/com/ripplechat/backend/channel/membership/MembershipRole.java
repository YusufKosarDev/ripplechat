package com.ripplechat.backend.channel.membership;

/**
 * Hierarchy: OWNER &gt; MODERATOR &gt; MEMBER.
 */
public enum MembershipRole {
    OWNER,
    MODERATOR,
    MEMBER;

    /** Owners and moderators may moderate (e.g. delete others' messages). */
    public boolean canModerate() {
        return this == OWNER || this == MODERATOR;
    }
}
