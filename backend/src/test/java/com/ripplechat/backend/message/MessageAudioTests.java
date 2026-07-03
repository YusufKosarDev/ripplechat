package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class MessageAudioTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;
    @Autowired
    MessageQueryService messageQueryService;

    @Test
    void audioAttachmentKeepsTypeAndIsExcludedFromGallery() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");

        MessageResponse msg = messageService.send(channel.id(),
                new CreateMessageRequest("", null, "https://res.cloudinary.com/demo/video/upload/ses.webm",
                        null, "ses.webm", "audio"),
                "owner");

        assertThat(msg.attachmentType()).isEqualTo("audio");
        assertThat(messageQueryService.listMedia(channel.id(), "owner")).isEmpty();
    }
}
