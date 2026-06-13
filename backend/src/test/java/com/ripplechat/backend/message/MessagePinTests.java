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

class MessagePinTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;

    @Test
    void pinListAndUnpin() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("önemli", null), "owner");

        messageService.pin(channel.id(), msg.id(), "owner");
        assertThat(messageService.listPinned(channel.id(), "owner"))
                .extracting(MessageResponse::id).containsExactly(msg.id());

        messageService.unpin(channel.id(), msg.id(), "owner");
        assertThat(messageService.listPinned(channel.id(), "owner")).isEmpty();
    }

    @Test
    void nonMemberCannotPin() {
        createUser("owner");
        createUser("outsider");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("x", null), "owner");

        assertThatThrownBy(() -> messageService.pin(channel.id(), msg.id(), "outsider"))
                .isInstanceOf(ForbiddenException.class);
    }
}
