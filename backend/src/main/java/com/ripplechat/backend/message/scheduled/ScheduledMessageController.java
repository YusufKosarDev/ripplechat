package com.ripplechat.backend.message.scheduled;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ScheduledMessageController {

    private final ScheduledMessageService scheduledMessageService;

    /** Queue a message for future delivery to the channel. */
    @PostMapping("/api/channels/{channelId}/messages/schedule")
    @ResponseStatus(HttpStatus.CREATED)
    public ScheduledMessageResponse schedule(@PathVariable UUID channelId,
                                             @Valid @RequestBody ScheduleMessageRequest request,
                                             @AuthenticationPrincipal String username) {
        return scheduledMessageService.schedule(channelId, username, request);
    }

    /** The caller's still-pending scheduled messages across all channels. */
    @GetMapping("/api/scheduled-messages")
    public List<ScheduledMessageResponse> listMine(@AuthenticationPrincipal String username) {
        return scheduledMessageService.listMine(username);
    }

    /** Cancel one of the caller's pending scheduled messages. */
    @DeleteMapping("/api/scheduled-messages/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@PathVariable UUID id, @AuthenticationPrincipal String username) {
        scheduledMessageService.cancel(id, username);
    }
}
