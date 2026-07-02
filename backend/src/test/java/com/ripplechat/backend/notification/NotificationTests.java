package com.ripplechat.backend.notification;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.ChannelResponse;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.message.MessageReactionService;
import com.ripplechat.backend.message.MessageService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.notification.dto.NotificationResponse;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    ChannelMembershipService membershipService;
    @Autowired
    MessageService messageService;
    @Autowired
    MessageReactionService reactionService;
    @Autowired
    NotificationService notificationService;

    private ChannelResponse channelWith(String owner, String member) {
        ChannelResponse channel = channelService.create(new CreateChannelRequest("gen", null, false), owner);
        membershipService.join(channel.id(), member);
        return channel;
    }

    @Test
    void reactionNotifiesTheMessageAuthorNotTheReactor() {
        createUser("author");
        createUser("reactor");
        ChannelResponse channel = channelWith("author", "reactor");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("hi", null), "author");

        reactionService.toggle(channel.id(), msg.id(), "reactor", "👍");

        assertThat(notificationService.unreadCount("author")).isEqualTo(1);
        assertThat(notificationService.unreadCount("reactor")).isZero();
        assertThat(notificationService.list("author", PageRequest.of(0, 20)).content())
                .singleElement()
                .satisfies(n -> {
                    assertThat(n.type()).isEqualTo(Notification.TYPE_REACTION);
                    assertThat(n.actor().username()).isEqualTo("reactor");
                    assertThat(n.messageId()).isEqualTo(msg.id());
                });
    }

    @Test
    void replyNotifiesTheParentAuthor() {
        createUser("author");
        createUser("replier");
        ChannelResponse channel = channelWith("author", "replier");
        MessageResponse parent = messageService.send(channel.id(), new CreateMessageRequest("q?", null), "author");

        messageService.send(channel.id(), new CreateMessageRequest("an answer", parent.id()), "replier");

        assertThat(notificationService.list("author", PageRequest.of(0, 20)).content())
                .extracting(NotificationResponse::type)
                .containsExactly(Notification.TYPE_REPLY);
    }

    @Test
    void mentionNotifiesTheMentionedMember() {
        createUser("author");
        createUser("bob");
        ChannelResponse channel = channelWith("author", "bob");

        messageService.send(channel.id(), new CreateMessageRequest("hey @bob look", null), "author");

        assertThat(notificationService.unreadCount("bob")).isEqualTo(1);
        assertThat(notificationService.list("bob", PageRequest.of(0, 20)).content())
                .singleElement()
                .satisfies(n -> assertThat(n.type()).isEqualTo(Notification.TYPE_MENTION));

        // markAllRead clears the unread counter.
        notificationService.markAllRead("bob");
        assertThat(notificationService.unreadCount("bob")).isZero();
    }
}
