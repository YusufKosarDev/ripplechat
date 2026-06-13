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

class MessageAttachmentTests extends AbstractIntegrationTest {

    private static final String IMAGE = "https://res.cloudinary.com/demo/image/upload/x.png";

    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;

    @Test
    void sendsImageOnlyMessageWithEmptyContent() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");

        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("", null, IMAGE), "owner");

        assertThat(msg.attachmentUrl()).isEqualTo(IMAGE);
        assertThat(msg.content()).isEmpty();
    }

    @Test
    void rejectsMessageWithNeitherContentNorAttachment() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");

        assertThatThrownBy(() -> messageService.send(channel.id(), new CreateMessageRequest("   ", null, null), "owner"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsAttachmentUrlFromAnotherHost() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");

        assertThatThrownBy(() -> messageService.send(
                channel.id(), new CreateMessageRequest("hi", null, "https://evil.example.com/x.png"), "owner"))
                .isInstanceOf(BadRequestException.class);
    }
}
