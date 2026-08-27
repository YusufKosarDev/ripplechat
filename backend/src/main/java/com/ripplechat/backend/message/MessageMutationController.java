package com.ripplechat.backend.message;

import com.ripplechat.backend.message.dto.EditMessageRequest;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

/**
 * Realtime edit/delete of a message (owner only — enforced in the service).
 * Updates broadcast on /topic/channels/{channelId}/message-updates.
 */
@Controller
public class MessageMutationController {

    private final MessageService messageService;
    private final MessageModerationService moderationService;

    public MessageMutationController(MessageService messageService, MessageModerationService moderationService) {
        this.messageService = messageService;
        this.moderationService = moderationService;
    }

    @MessageMapping("/channels/{channelId}/messages/{messageId}/edit")
    public void edit(@DestinationVariable UUID channelId,
                     @DestinationVariable UUID messageId,
                     @Payload EditMessageRequest request,
                     Principal principal) {
        messageService.editMessage(channelId, messageId, principal.getName(), request.content());
    }

    @MessageMapping("/channels/{channelId}/messages/{messageId}/delete")
    public void delete(@DestinationVariable UUID channelId,
                       @DestinationVariable UUID messageId,
                       Principal principal) {
        moderationService.deleteMessage(channelId, messageId, principal.getName());
    }
}
