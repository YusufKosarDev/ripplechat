package com.ripplechat.backend.websocket;

import com.ripplechat.backend.message.MessageService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

/**
 * Realtime entry point. A client sends to /app/channels/{channelId}/send; the
 * message is persisted via the existing service and then broadcast to everyone
 * subscribed to /topic/channels/{channelId}.
 */
@Controller
public class ChatController {

    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatController(MessageService messageService, SimpMessagingTemplate messagingTemplate) {
        this.messageService = messageService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/channels/{channelId}/send")
    public void send(@DestinationVariable UUID channelId,
                     @Payload CreateMessageRequest request,
                     Principal principal) {
        MessageResponse response = messageService.send(channelId, request, principal.getName());
        messagingTemplate.convertAndSend("/topic/channels/" + channelId, response);
    }
}
