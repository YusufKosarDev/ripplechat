package com.ripplechat.backend.search.dto;

import java.util.List;

/**
 * One page of search results. {@code hasMore} is derived from the raw ranked
 * page (before sender/date post-filtering), so the client can reliably decide
 * whether to offer "load more" even when filters hide some hits on a page.
 */
public record SearchPageResponse(List<SearchResultResponse> results, boolean hasMore) {
}
