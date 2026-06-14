package com.ripplechat.backend.search;

import com.ripplechat.backend.search.dto.SearchResultResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping("/messages")
    public List<SearchResultResponse> search(
            @RequestParam(value = "q", required = false, defaultValue = "") String q,
            @RequestParam(value = "channelId", required = false) UUID channelId,
            @RequestParam(value = "from", required = false) String from,
            @RequestParam(value = "since", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate since,
            @AuthenticationPrincipal String username) {
        Instant sinceInstant = since == null ? null : since.atStartOfDay(ZoneOffset.UTC).toInstant();
        return searchService.searchMessages(username, q, channelId, from, sinceInstant);
    }
}
