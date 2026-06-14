package com.ripplechat.backend.link;

/** Open Graph / page metadata for a URL, shown as a preview card. */
public record LinkPreview(
        String url,
        String title,
        String description,
        String image,
        String siteName
) {
}
