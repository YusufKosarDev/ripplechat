package com.ripplechat.backend.message;

import com.ripplechat.backend.message.dto.ToggleReactionRequest;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

@Controller
public class MessageReactionController {

    private final MessageReactionService messageReactionService;

    public MessageReactionController(MessageReactionService messageReactionService) {
        this.messageReactionService = messageReactionService;
    }

    @MessageMapping("/channels/{channelId}/messages/{messageId}/reaction")
    public void toggle(@DestinationVariable UUID channelId,
                       @DestinationVariable UUID messageId,
                       @Payload ToggleReactionRequest request,
                       Principal principal) {
        messageReactionService.toggle(channelId, messageId, principal.getName(), request.emoji());
    }
}
