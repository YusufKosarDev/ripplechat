package com.ripplechat.backend.bookmark;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.ChannelResponse;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.message.MessageService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SavedMessageTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    ChannelMembershipService membershipService;
    @Autowired
    MessageService messageService;
    @Autowired
    SavedMessageService savedMessageService;

    @Test
    void saveListsThenUnsavesAndIsIdempotent() {
        createUser("author");
        createUser("saver");
        ChannelResponse channel = channelService.create(new CreateChannelRequest("gen", null, false), "author");
        membershipService.join(channel.id(), "saver");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("save me", null), "author");

        savedMessageService.save("saver", msg.id());
        assertThat(savedMessageService.savedIds("saver")).containsExactly(msg.id());
        assertThat(savedMessageService.list("saver")).singleElement().satisfies(s -> {
            assertThat(s.messageId()).isEqualTo(msg.id());
            assertThat(s.content()).isEqualTo("save me");
            assertThat(s.channelName()).isEqualTo("gen");
        });

        // Saving again is a no-op.
        savedMessageService.save("saver", msg.id());
        assertThat(savedMessageService.savedIds("saver")).hasSize(1);

        savedMessageService.unsave("saver", msg.id());
        assertThat(savedMessageService.savedIds("saver")).isEmpty();
    }

    @Test
    void leavingAChannelHidesItsBookmarksAgain() {
        createUser("author");
        createUser("saver");
        ChannelResponse channel = channelService.create(new CreateChannelRequest("gen", null, false), "author");
        membershipService.join(channel.id(), "saver");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("kept", null), "author");
        savedMessageService.save("saver", msg.id());
        assertThat(savedMessageService.list("saver")).hasSize(1);

        membershipService.leave(channel.id(), "saver");

        // Membership was checked when saving and never again, so a bookmark
        // outlived access to the channel it came from.
        assertThat(savedMessageService.list("saver")).isEmpty();
    }

    @Test
    void cannotBookmarkAMessageInAChannelYouAreNotIn() {
        createUser("author");
        createUser("outsider");
        ChannelResponse secret = channelService.create(new CreateChannelRequest("secret", null, true), "author");
        MessageResponse msg = messageService.send(secret.id(), new CreateMessageRequest("hush", null), "author");

        assertThatThrownBy(() -> savedMessageService.save("outsider", msg.id()))
                .isInstanceOf(ForbiddenException.class);
        assertThat(savedMessageService.savedIds("outsider")).isEmpty();
    }
}
