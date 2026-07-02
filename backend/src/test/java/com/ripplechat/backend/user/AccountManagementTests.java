package com.ripplechat.backend.user;

import com.ripplechat.backend.auth.AuthService;
import com.ripplechat.backend.auth.dto.LoginRequest;
import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.ChannelResponse;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.InvalidCredentialsException;
import com.ripplechat.backend.message.MessageRepository;
import com.ripplechat.backend.message.MessageService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.dto.AccountExport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AccountManagementTests extends AbstractIntegrationTest {

    @Autowired
    AccountManagementService accountManagementService;
    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;
    @Autowired
    MessageRepository messageRepository;
    @Autowired
    AuthService authService;

    @Test
    void exportReturnsProfileMembershipsAndAuthoredMessages() {
        createUser("alice");
        ChannelResponse channel = channelService.create(new CreateChannelRequest("gen", null, false), "alice");
        messageService.send(channel.id(), new CreateMessageRequest("hello world", null), "alice");

        AccountExport export = accountManagementService.export("alice");

        assertThat(export.profile().username()).isEqualTo("alice");
        assertThat(export.profile().email()).isEqualTo("alice@test.io");
        assertThat(export.memberships())
                .extracting(AccountExport.Membership::channelName).contains("gen");
        assertThat(export.messages())
                .extracting(AccountExport.AuthoredMessage::content).contains("hello world");
    }

    @Test
    void deleteAnonymisesTheAccountKeepsMessagesAndBlocksLogin() {
        User user = createUser("bob");
        UUID id = user.getId();
        ChannelResponse channel = channelService.create(new CreateChannelRequest("c", null, false), "bob");
        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("bye", null), "bob");

        accountManagementService.delete("bob", "password123");

        User after = userRepository.findById(id).orElseThrow();
        assertThat(after.isDeleted()).isTrue();
        assertThat(after.getUsername()).startsWith("deleted_");
        assertThat(after.getEmail()).doesNotContain("bob@test.io");
        assertThat(after.getPassword()).isNull();
        assertThat(after.getDisplayName()).isEqualTo("Deleted User");

        // The message is retained (conversation integrity for others).
        assertThat(messageRepository.findById(msg.id())).isPresent();

        // The old identity can no longer sign in.
        assertThatThrownBy(() -> authService.login(new LoginRequest("bob", "password123")))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void deleteWithWrongPasswordIsRejectedAndLeavesTheAccountIntact() {
        createUser("carol");

        assertThatThrownBy(() -> accountManagementService.delete("carol", "wrong-password"))
                .isInstanceOf(BadRequestException.class);

        assertThat(userRepository.findByUsername("carol")).isPresent();
    }
}
