package com.ripplechat.backend.channel;

import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.channel.dto.UpdateChannelRequest;
import com.ripplechat.backend.channel.membership.ChannelMembership;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.channel.membership.MembershipRole;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChannelAuthorizationTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    ChannelMembershipService membershipService;
    @Autowired
    ChannelMembershipRepository membershipRepository;
    @Autowired
    DirectMessageService directMessageService;

    @Test
    void channelCreatorBecomesOwner() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("general", "desc", false), "owner");
        MembershipRole role = membershipRepository
                .findByChannelIdAndUser_Username(channel.id(), "owner")
                .map(ChannelMembership::getRole)
                .orElse(null);
        assertThat(role).isEqualTo(MembershipRole.OWNER);
    }

    @Test
    void nonMemberCannotAccessPrivateChannel() {
        createUser("owner");
        createUser("outsider");
        var channel = channelService.create(new CreateChannelRequest("secret", null, true), "owner");

        assertThatThrownBy(() -> channelService.findById(channel.id(), "outsider"))
                .isInstanceOf(ForbiddenException.class);
        // the owner (a member) can read it
        assertThat(channelService.findById(channel.id(), "owner").id()).isEqualTo(channel.id());
    }

    @Test
    void onlyOwnerCanUpdateChannel() {
        createUser("owner");
        createUser("member");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        membershipService.join(channel.id(), "member");

        assertThatThrownBy(() -> channelService.update(channel.id(), "member", new UpdateChannelRequest("hacked", null)))
                .isInstanceOf(ForbiddenException.class);
        assertThat(channelService.update(channel.id(), "owner", new UpdateChannelRequest("renamed", null)).name())
                .isEqualTo("renamed");
    }

    @Test
    void outsiderCannotJoinPrivateChannelByKnowingItsId() {
        createUser("owner");
        createUser("outsider");
        var channel = channelService.create(new CreateChannelRequest("secret", null, true), "owner");

        // Knowing the id used to be enough: join() admitted anyone, and every
        // other read is gated on membership, so it handed over the whole channel.
        assertThatThrownBy(() -> membershipService.join(channel.id(), "outsider"))
                .isInstanceOf(ForbiddenException.class);
        assertThat(membershipService.isMember(channel.id(), "outsider")).isFalse();
    }

    @Test
    void outsiderCannotJoinADirectMessage() {
        User alice = createUser("alice");
        createUser("bob");
        createUser("snoop");
        var dm = directMessageService.openOrCreate("bob", alice.getId());

        assertThatThrownBy(() -> membershipService.join(dm.id(), "snoop"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void anyoneCanStillJoinAPublicChannel() {
        createUser("owner");
        createUser("joiner");
        var channel = channelService.create(new CreateChannelRequest("general", null, false), "owner");

        assertThat(membershipService.join(channel.id(), "joiner").role()).isEqualTo(MembershipRole.MEMBER);
        // Idempotent: joining twice is not an error.
        assertThat(membershipService.join(channel.id(), "joiner").role()).isEqualTo(MembershipRole.MEMBER);
    }

    @Test
    void ownerAddsMembersToAPrivateChannel() {
        createUser("owner");
        User invited = createUser("invited");
        createUser("bystander");
        var channel = channelService.create(new CreateChannelRequest("secret", null, true), "owner");

        assertThat(membershipService.addMember(channel.id(), "owner", invited.getId()).role())
                .isEqualTo(MembershipRole.MEMBER);
        assertThat(membershipService.isMember(channel.id(), "invited")).isTrue();

        // A plain member may not widen the channel.
        assertThatThrownBy(() ->
                membershipService.addMember(channel.id(), "invited", userRepository
                        .findByUsername("bystander").orElseThrow().getId()))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void privateChannelMemberListIsNotReadableByOutsiders() {
        createUser("owner");
        createUser("outsider");
        var privateChannel = channelService.create(new CreateChannelRequest("secret", null, true), "owner");
        var publicChannel = channelService.create(new CreateChannelRequest("general", null, false), "owner");

        assertThatThrownBy(() -> membershipService.listMembers(privateChannel.id(), "outsider"))
                .isInstanceOf(ForbiddenException.class);
        assertThat(membershipService.listMembers(privateChannel.id(), "owner")).hasSize(1);
        // A public channel's roster stays visible — the join screen shows it.
        assertThat(membershipService.listMembers(publicChannel.id(), "outsider")).hasSize(1);
    }

    @Test
    void onlyOwnerCanPromoteAndKick() {
        createUser("owner");
        User member = createUser("member");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        membershipService.join(channel.id(), "member");

        // a plain member cannot moderate
        assertThatThrownBy(() -> membershipService.setRole(channel.id(), "member", member.getId(), MembershipRole.MODERATOR))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> membershipService.kick(channel.id(), "member", member.getId()))
                .isInstanceOf(ForbiddenException.class);

        // the owner can promote, then kick
        assertThat(membershipService.setRole(channel.id(), "owner", member.getId(), MembershipRole.MODERATOR).role())
                .isEqualTo(MembershipRole.MODERATOR);
        membershipService.kick(channel.id(), "owner", member.getId());
        assertThat(membershipService.isMember(channel.id(), "member")).isFalse();
    }
}
