package com.ripplechat.backend.reaction;

import com.ripplechat.backend.reaction.dto.ReactionRequest;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

@Controller
public class ReactionController {

    private final ReactionService reactionService;

    public ReactionController(ReactionService reactionService) {
        this.reactionService = reactionService;
    }

    @MessageMapping("/channels/{channelId}/reaction")
    public void react(@DestinationVariable UUID channelId,
                      @Payload ReactionRequest request,
                      Principal principal) {
        reactionService.relayReaction(channelId, principal.getName(), request.emoji());
    }
}
