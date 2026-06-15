package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.ChannelResponse;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class DisappearingMessageTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;
    @Autowired
    MessageRepository messageRepository;

    @Test
    void timerStampsExpiryAndCanBeTurnedOff() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");

        ChannelResponse on = channelService.setDisappearing(channel.id(), "owner", 3600);
        assertThat(on.messageTtlSeconds()).isEqualTo(3600);

        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("hi", null), "owner");
        assertThat(msg.expiresAt()).isNotNull();

        ChannelResponse off = channelService.setDisappearing(channel.id(), "owner", 0);
        assertThat(off.messageTtlSeconds()).isNull();

        MessageResponse plain = messageService.send(channel.id(), new CreateMessageRequest("bye", null), "owner");
        assertThat(plain.expiresAt()).isNull();
    }

    @Test
    void purgeExpiredSoftDeletesPastMessages() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        channelService.setDisappearing(channel.id(), "owner", 3600);

        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("secret", null), "owner");

        Message stored = messageRepository.findById(msg.id()).orElseThrow();
        stored.setExpiresAt(Instant.now().minusSeconds(10));
        messageRepository.saveAndFlush(stored);

        messageService.purgeExpired();

        Message after = messageRepository.findById(msg.id()).orElseThrow();
        assertThat(after.isDeleted()).isTrue();
        assertThat(after.getContent()).isEmpty();
    }
}
