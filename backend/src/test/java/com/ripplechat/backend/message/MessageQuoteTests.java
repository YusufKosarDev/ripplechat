package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class MessageQuoteTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;

    @Test
    void quotesAMessageInTheSameChannel() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        MessageResponse first = messageService.send(channel.id(), new CreateMessageRequest("merhaba dünya", null), "owner");

        MessageResponse reply = messageService.send(
                channel.id(), new CreateMessageRequest("evet!", null, null, first.id()), "owner");

        assertThat(reply.quotedMessageId()).isEqualTo(first.id());
        assertThat(reply.quotedSender()).isEqualTo("owner");
        assertThat(reply.quotedContent()).contains("merhaba");
    }

    @Test
    void ignoresAQuoteFromAnotherChannel() {
        createUser("owner");
        var a = channelService.create(new CreateChannelRequest("a", null, false), "owner");
        var b = channelService.create(new CreateChannelRequest("b", null, false), "owner");
        MessageResponse inA = messageService.send(a.id(), new CreateMessageRequest("gizli", null), "owner");

        MessageResponse reply = messageService.send(
                b.id(), new CreateMessageRequest("hmm", null, null, inA.id()), "owner");

        assertThat(reply.quotedMessageId()).isNull();
    }
}
