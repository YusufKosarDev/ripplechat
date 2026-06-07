package com.ripplechat.backend.typing;

import com.ripplechat.backend.typing.dto.TypingRequest;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

@Controller
public class TypingController {

    private final TypingService typingService;

    public TypingController(TypingService typingService) {
        this.typingService = typingService;
    }

    @MessageMapping("/channels/{channelId}/typing")
    public void typing(@DestinationVariable UUID channelId,
                       @Payload TypingRequest request,
                       Principal principal) {
        typingService.relayTyping(channelId, principal.getName(), request.typing());
    }
}
