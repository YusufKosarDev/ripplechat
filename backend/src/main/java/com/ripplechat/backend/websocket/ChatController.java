package com.ripplechat.backend.websocket;

import com.ripplechat.backend.message.MessageService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

/**
 * Realtime entry point. A client sends to /app/channels/{channelId}/send; the
 * service persists it and broadcasts to the right topic (main feed for a
 * top-level message, the thread topic for a reply with a parentMessageId).
 */
@Controller
public class ChatController {

    private final MessageService messageService;

    public ChatController(MessageService messageService) {
        this.messageService = messageService;
    }

    @MessageMapping("/channels/{channelId}/send")
    public void send(@DestinationVariable UUID channelId,
                     @Payload CreateMessageRequest request,
                     Principal principal) {
        messageService.send(channelId, request, principal.getName());
    }
}
