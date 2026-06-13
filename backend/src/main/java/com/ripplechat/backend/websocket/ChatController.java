package com.ripplechat.backend.websocket;

import com.ripplechat.backend.message.MessageService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.read.ReadReceiptService;
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
    private final ReadReceiptService readReceiptService;

    public ChatController(MessageService messageService, ReadReceiptService readReceiptService) {
        this.messageService = messageService;
        this.readReceiptService = readReceiptService;
    }

    @MessageMapping("/channels/{channelId}/send")
    public void send(@DestinationVariable UUID channelId,
                     @Payload CreateMessageRequest request,
                     Principal principal) {
        messageService.send(channelId, request, principal.getName());
    }

    /** Marks the channel read up to now for the sender (powers read receipts). */
    @MessageMapping("/channels/{channelId}/read")
    public void read(@DestinationVariable UUID channelId, Principal principal) {
        readReceiptService.markRead(channelId, principal.getName());
    }
}
