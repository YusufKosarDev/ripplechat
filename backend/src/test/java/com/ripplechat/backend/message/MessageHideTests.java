package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;

class MessageHideTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    ChannelMembershipService membershipService;
    @Autowired
    MessageService messageService;
    @Autowired
    MessageModerationService moderationService;

    @Test
    void hideRemovesFromMyFeedButNotOthers() {
        createUser("owner");
        createUser("member");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        membershipService.join(channel.id(), "member");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("gizle beni", null), "owner");

        moderationService.hideForMe(channel.id(), msg.id(), "member");

        var memberFeed = messageService.findByChannel(channel.id(), "member", PageRequest.of(0, 50));
        assertThat(memberFeed.content()).extracting(MessageResponse::id).doesNotContain(msg.id());

        var ownerFeed = messageService.findByChannel(channel.id(), "owner", PageRequest.of(0, 50));
        assertThat(ownerFeed.content()).extracting(MessageResponse::id).contains(msg.id());
    }
}
