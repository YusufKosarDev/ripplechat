package com.ripplechat.backend.search;

import com.ripplechat.backend.search.dto.SearchResultResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping("/messages")
    public List<SearchResultResponse> search(@RequestParam(value = "q", required = false, defaultValue = "") String q,
                                             @AuthenticationPrincipal String username) {
        return searchService.searchMessages(username, q);
    }
}
