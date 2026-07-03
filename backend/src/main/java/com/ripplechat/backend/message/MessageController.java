package com.ripplechat.backend.message;

import com.ripplechat.backend.common.dto.PageResponse;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.ForwardRequest;
import com.ripplechat.backend.message.dto.MediaItem;
import com.ripplechat.backend.message.dto.MessageEditHistoryEntry;
import com.ripplechat.backend.message.dto.MessageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/channels/{channelId}/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;
    private final MessageQueryService messageQueryService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse send(@PathVariable UUID channelId,
                                @Valid @RequestBody CreateMessageRequest request,
                                @AuthenticationPrincipal String username) {
        return messageService.send(channelId, request, username);
    }

    /** Forwards an existing message into this channel. */
    @PostMapping("/forward")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse forward(@PathVariable UUID channelId,
                                   @Valid @RequestBody ForwardRequest request,
                                   @AuthenticationPrincipal String username) {
        return messageService.forward(channelId, request.sourceMessageId(), username);
    }

    @GetMapping("/pinned")
    public List<MessageResponse> pinned(@PathVariable UUID channelId,
                                        @AuthenticationPrincipal String username) {
        return messageQueryService.listPinned(channelId, username);
    }

    @GetMapping("/media")
    public List<MediaItem> media(@PathVariable UUID channelId,
                                 @AuthenticationPrincipal String username) {
        return messageQueryService.listMedia(channelId, username);
    }

    /** Prior versions of an edited message (newest first). */
    @GetMapping("/{messageId}/history")
    public List<MessageEditHistoryEntry> history(@PathVariable UUID channelId,
                                                 @PathVariable UUID messageId,
                                                 @AuthenticationPrincipal String username) {
        return messageService.editHistory(channelId, messageId, username);
    }

    @PostMapping("/{messageId}/pin")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void pin(@PathVariable UUID channelId, @PathVariable UUID messageId,
                    @AuthenticationPrincipal String username) {
        messageService.pin(channelId, messageId, username);
    }

    @DeleteMapping("/{messageId}/pin")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unpin(@PathVariable UUID channelId, @PathVariable UUID messageId,
                      @AuthenticationPrincipal String username) {
        messageService.unpin(channelId, messageId, username);
    }

    /** "Delete for me": hides the message from the caller's feed only. */
    @PostMapping("/{messageId}/hide")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void hide(@PathVariable UUID channelId, @PathVariable UUID messageId,
                     @AuthenticationPrincipal String username) {
        messageService.hideForMe(channelId, messageId, username);
    }

    @GetMapping
    public PageResponse<MessageResponse> list(
            @PathVariable UUID channelId,
            @AuthenticationPrincipal String username,
            @PageableDefault(size = 50, sort = "createdAt", direction = Sort.Direction.ASC) Pageable pageable) {
        return messageService.findByChannel(channelId, username, pageable);
    }
}
