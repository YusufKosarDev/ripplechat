package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MessageGifTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;

    @Test
    void acceptsGiphyHostedAttachment() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        String gif = "https://media1.giphy.com/media/abc/giphy.gif";

        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("", null, gif), "owner");
        assertThat(msg.attachmentUrl()).isEqualTo(gif);
    }

    @Test
    void rejectsArbitraryHostAttachment() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");

        assertThatThrownBy(() -> messageService.send(
                channel.id(), new CreateMessageRequest("", null, "https://evil.example.com/x.gif"), "owner"))
                .isInstanceOf(BadRequestException.class);
    }
}
