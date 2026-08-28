package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MessageForwardTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;

    @Test
    void forwardsContentIntoAnotherChannelAndMarksForwarded() {
        createUser("owner");
        var a = channelService.create(new CreateChannelRequest("a", null, false), "owner");
        var b = channelService.create(new CreateChannelRequest("b", null, false), "owner");
        MessageResponse src = messageService.send(a.id(), new CreateMessageRequest("merhaba", null), "owner");

        MessageResponse fwd = messageService.forward(b.id(), src.id(), "owner");

        assertThat(fwd.content()).isEqualTo("merhaba");
        assertThat(fwd.forwarded()).isTrue();
        assertThat(fwd.channelId()).isEqualTo(b.id());
    }

    @Test
    void forwardCarriesTheAttachmentMetadataAndTheTargetsTimer() {
        createUser("owner");
        var a = channelService.create(new CreateChannelRequest("a", null, false), "owner");
        var b = channelService.create(new CreateChannelRequest("b", null, false), "owner");
        channelService.setDisappearing(b.id(), "owner", 3600);

        MessageResponse src = messageService.send(a.id(), new CreateMessageRequest(
                "", null, "https://res.cloudinary.com/demo/raw/upload/notes.pdf", null, "notes.pdf", "file"), "owner");

        MessageResponse fwd = messageService.forward(b.id(), src.id(), "owner");

        // Only the URL used to come across: the copy arrived with no filename and
        // a null type, which renders as an image and downloads without a name.
        assertThat(fwd.attachmentName()).isEqualTo("notes.pdf");
        assertThat(fwd.attachmentType()).isEqualTo("file");
        // And it ignored the target channel's disappearing-message timer, which
        // made forwarding a way to make a message permanent there.
        assertThat(fwd.expiresAt()).isNotNull();
    }

    @Test
    void cannotForwardAMessageFromAChannelYouAreNotIn() {
        createUser("owner");
        createUser("outsider");
        var a = channelService.create(new CreateChannelRequest("a", null, false), "owner");
        var b = channelService.create(new CreateChannelRequest("b", null, false), "outsider");
        MessageResponse src = messageService.send(a.id(), new CreateMessageRequest("gizli", null), "owner");

        assertThatThrownBy(() -> messageService.forward(b.id(), src.id(), "outsider"))
                .isInstanceOf(ForbiddenException.class);
    }
}
