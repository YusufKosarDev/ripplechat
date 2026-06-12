package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.channel.membership.MembershipRole;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MessageAuthorizationTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    ChannelMembershipService membershipService;
    @Autowired
    MessageService messageService;

    @Test
    void nonMemberCannotSendOrReadMessages() {
        createUser("owner");
        createUser("outsider");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");

        assertThatThrownBy(() -> messageService.send(channel.id(), new CreateMessageRequest("hi", null), "outsider"))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> messageService.findByChannel(channel.id(), "outsider", PageRequest.of(0, 20)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void onlyAuthorCanEditTheirMessage() {
        createUser("owner");
        createUser("member");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        membershipService.join(channel.id(), "member");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("original", null), "owner");

        // another member editing someone else's message is rejected
        assertThatThrownBy(() -> messageService.editMessage(channel.id(), msg.id(), "member", "hacked"))
                .isInstanceOf(ForbiddenException.class);

        // the author can edit
        messageService.editMessage(channel.id(), msg.id(), "owner", "edited");
        var page = messageService.findByChannel(channel.id(), "owner", PageRequest.of(0, 20));
        assertThat(page.content().get(0).content()).isEqualTo("edited");
    }

    @Test
    void deleteAllowedForAuthorAndModeratorButNotPlainMember() {
        createUser("owner");
        createUser("author");
        createUser("member");
        User mod = createUser("mod");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        membershipService.join(channel.id(), "author");
        membershipService.join(channel.id(), "member");
        membershipService.join(channel.id(), "mod");
        membershipService.setRole(channel.id(), "owner", mod.getId(), MembershipRole.MODERATOR);

        MessageResponse m1 = messageService.send(channel.id(), new CreateMessageRequest("m1", null), "author");
        // a plain member cannot delete someone else's message
        assertThatThrownBy(() -> messageService.deleteMessage(channel.id(), m1.id(), "member"))
                .isInstanceOf(ForbiddenException.class);
        // a moderator can
        assertThatCode(() -> messageService.deleteMessage(channel.id(), m1.id(), "mod")).doesNotThrowAnyException();

        // and the author can delete their own
        MessageResponse m2 = messageService.send(channel.id(), new CreateMessageRequest("m2", null), "author");
        assertThatCode(() -> messageService.deleteMessage(channel.id(), m2.id(), "author")).doesNotThrowAnyException();
    }
}
