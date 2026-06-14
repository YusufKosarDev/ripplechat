package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MediaItem;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MediaGalleryTests extends AbstractIntegrationTest {

    private static final String IMAGE = "https://res.cloudinary.com/demo/image/upload/x.png";

    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;

    @Test
    void listsOnlyImageAttachments() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        messageService.send(channel.id(), new CreateMessageRequest("", null, IMAGE), "owner");
        messageService.send(channel.id(), new CreateMessageRequest("sadece metin", null), "owner");

        var media = messageService.listMedia(channel.id(), "owner");
        assertThat(media).hasSize(1);
        assertThat(media.get(0).url()).isEqualTo(IMAGE);
    }

    @Test
    void fileAttachmentsAreExcludedFromGallery() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        messageService.send(channel.id(), new CreateMessageRequest("", null, IMAGE), "owner");
        messageService.send(channel.id(),
                new CreateMessageRequest("", null, "https://res.cloudinary.com/demo/raw/upload/rapor.pdf",
                        null, "rapor.pdf", "file"),
                "owner");

        var media = messageService.listMedia(channel.id(), "owner");
        assertThat(media).hasSize(1);
        assertThat(media.get(0).url()).isEqualTo(IMAGE);
    }

    @Test
    void nonMemberCannotListMedia() {
        createUser("owner");
        createUser("outsider");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");

        assertThatThrownBy(() -> messageService.listMedia(channel.id(), "outsider"))
                .isInstanceOf(ForbiddenException.class);
    }
}
