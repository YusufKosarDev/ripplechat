package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.common.MessagePreview;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageEditHistoryEntry;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MessageEditHistoryTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;
    @Autowired
    MessageQueryService messageQueryService;
    @Autowired
    MessageModerationService moderationService;
    @Autowired
    MessageEditHistoryRepository messageEditHistoryRepository;
    @Autowired
    MessageRepository messageRepository;

    @Test
    void editsAreRecordedNewestFirst() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("v1", null), "owner");

        assertThat(messageQueryService.editHistory(channel.id(), msg.id(), "owner")).isEmpty();

        messageService.editMessage(channel.id(), msg.id(), "owner", "v2");
        messageService.editMessage(channel.id(), msg.id(), "owner", "v3");

        // History holds the two superseded versions, newest replacement first.
        assertThat(messageQueryService.editHistory(channel.id(), msg.id(), "owner"))
                .extracting(MessageEditHistoryEntry::content)
                .containsExactly("v2", "v1");
    }

    @Test
    void deletingAMessageTakesItsEarlierVersionsWithIt() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("secret v1", null), "owner");
        messageService.editMessage(channel.id(), msg.id(), "owner", "harmless v2");

        moderationService.deleteMessage(channel.id(), msg.id(), "owner");

        // The original text used to stay readable through the history endpoint
        // after the message itself was gone — including for messages removed by
        // the disappearing-message timer.
        assertThat(messageQueryService.editHistory(channel.id(), msg.id(), "owner")).isEmpty();
        assertThat(messageEditHistoryRepository.findByMessage_IdOrderByEditedAtDesc(msg.id())).isEmpty();
    }

    @Test
    void deletingAMessageScrubsTheQuotesThatCopiedIt() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        MessageResponse quoted = messageService.send(
                channel.id(), new CreateMessageRequest("the secret", null), "owner");
        MessageResponse reply = messageService.send(
                channel.id(), new CreateMessageRequest("re", null, null, quoted.id()), "owner");
        assertThat(messageRepository.findById(reply.id()).orElseThrow().getQuotedContent())
                .isEqualTo("the secret");

        moderationService.deleteMessage(channel.id(), quoted.id(), "owner");

        // The quote preview is a denormalised copy, so deleting the original was
        // leaving its words on display wherever it had been quoted.
        assertThat(messageRepository.findById(reply.id()).orElseThrow().getQuotedContent())
                .isEqualTo(MessagePreview.DELETED);
    }

    @Test
    void noOpEditDoesNotRecordHistory() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("same", null), "owner");

        messageService.editMessage(channel.id(), msg.id(), "owner", "same");

        assertThat(messageQueryService.editHistory(channel.id(), msg.id(), "owner")).isEmpty();
    }

    @Test
    void blankEditIsRejectedAndRecordsNoHistory() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("v1", null), "owner");

        assertThatThrownBy(() -> messageService.editMessage(channel.id(), msg.id(), "owner", "   "))
                .isInstanceOf(BadRequestException.class);

        assertThat(messageQueryService.editHistory(channel.id(), msg.id(), "owner")).isEmpty();
    }

    @Test
    void nonMemberCannotReadHistory() {
        createUser("owner");
        createUser("outsider");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("v1", null), "owner");
        messageService.editMessage(channel.id(), msg.id(), "owner", "v2");

        assertThatThrownBy(() -> messageQueryService.editHistory(channel.id(), msg.id(), "outsider"))
                .isInstanceOf(ForbiddenException.class);
    }
}
