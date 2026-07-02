package com.ripplechat.backend.bookmark;

import com.ripplechat.backend.bookmark.dto.SavedMessageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/bookmarks")
@RequiredArgsConstructor
public class BookmarkController {

    private final SavedMessageService savedMessageService;

    /** The caller's saved messages, newest first. */
    @GetMapping
    public List<SavedMessageResponse> list(@AuthenticationPrincipal String username) {
        return savedMessageService.list(username);
    }

    /** Just the bookmarked message ids, for toggling the save icon in the feed. */
    @GetMapping("/ids")
    public List<UUID> ids(@AuthenticationPrincipal String username) {
        return savedMessageService.savedIds(username);
    }

    @PostMapping("/{messageId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void save(@PathVariable UUID messageId, @AuthenticationPrincipal String username) {
        savedMessageService.save(username, messageId);
    }

    @DeleteMapping("/{messageId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsave(@PathVariable UUID messageId, @AuthenticationPrincipal String username) {
        savedMessageService.unsave(username, messageId);
    }
}
