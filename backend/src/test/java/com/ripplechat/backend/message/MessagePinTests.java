package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.channel.membership.MembershipRole;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MessagePinTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;
    @Autowired
    MessageModerationService moderationService;
    @Autowired
    MessageQueryService messageQueryService;
    @Autowired
    ChannelMembershipService membershipService;

    @Test
    void pinListAndUnpin() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("önemli", null), "owner");

        moderationService.pin(channel.id(), msg.id(), "owner");
        assertThat(messageQueryService.listPinned(channel.id(), "owner"))
                .extracting(MessageResponse::id).containsExactly(msg.id());

        moderationService.unpin(channel.id(), msg.id(), "owner");
        assertThat(messageQueryService.listPinned(channel.id(), "owner")).isEmpty();
    }

    @Test
    void pinningSomeoneElsesMessageTakesModeratorAuthority() {
        createUser("owner");
        User member = createUser("member");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        membershipService.join(channel.id(), "member");
        MessageResponse ownersMessage = messageService.send(
                channel.id(), new CreateMessageRequest("x", null), "owner");

        // Pinning changes what the whole channel sees at the top, so a plain
        // member could previously reorder everyone's view of any message.
        assertThatThrownBy(() -> moderationService.pin(channel.id(), ownersMessage.id(), "member"))
                .isInstanceOf(ForbiddenException.class);

        // Your own message is yours to pin.
        MessageResponse ownMessage = messageService.send(
                channel.id(), new CreateMessageRequest("mine", null), "member");
        moderationService.pin(channel.id(), ownMessage.id(), "member");
        assertThat(messageQueryService.listPinned(channel.id(), "member"))
                .extracting(MessageResponse::id).containsExactly(ownMessage.id());

        // And a moderator may pin anyone's.
        membershipService.setRole(channel.id(), "owner", member.getId(), MembershipRole.MODERATOR);
        moderationService.pin(channel.id(), ownersMessage.id(), "member");
        assertThat(messageQueryService.listPinned(channel.id(), "member")).hasSize(2);
    }

    @Test
    void nonMemberCannotPin() {
        createUser("owner");
        createUser("outsider");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("x", null), "owner");

        assertThatThrownBy(() -> moderationService.pin(channel.id(), msg.id(), "outsider"))
                .isInstanceOf(ForbiddenException.class);
    }
}
