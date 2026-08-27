package com.ripplechat.backend.message;

import com.ripplechat.backend.message.dto.MessageResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/channels/{channelId}/messages/{messageId}/thread")
public class ThreadController {

    private final MessageQueryService messageQueryService;

    public ThreadController(MessageQueryService messageQueryService) {
        this.messageQueryService = messageQueryService;
    }

    @GetMapping
    public List<MessageResponse> thread(@PathVariable UUID channelId,
                                        @PathVariable UUID messageId,
                                        @AuthenticationPrincipal String username) {
        return messageQueryService.listThread(channelId, messageId, username);
    }
}
