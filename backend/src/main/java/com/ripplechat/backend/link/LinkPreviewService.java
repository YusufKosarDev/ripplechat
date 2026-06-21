package com.ripplechat.backend.link;

import com.ripplechat.backend.common.CacheConfig;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Fetches Open Graph / page metadata for a URL to render a preview card.
 *
 * <p>SSRF-guarded: only http/https, redirects followed manually with the target
 * re-validated each hop, and private/loopback/link-local addresses rejected.
 * Successful previews are cached (Caffeine, with a TTL) keyed by URL.
 */
@Service
public class LinkPreviewService {

    private static final Logger log = LoggerFactory.getLogger(LinkPreviewService.class);
    private static final int MAX_BODY_BYTES = 512 * 1024;
    private static final int MAX_REDIRECTS = 3;

    private final HttpClient http = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Cacheable(cacheNames = CacheConfig.LINK_PREVIEWS, key = "#rawUrl.trim()",
            condition = "#rawUrl != null && !#rawUrl.isBlank()",
            unless = "#result == null")
    public LinkPreview preview(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return null;
        }
        return fetch(rawUrl.trim());
    }

    private LinkPreview fetch(String rawUrl) {
        try {
            URI uri = URI.create(rawUrl);
            for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
                if (!isAllowed(uri)) {
                    return null;
                }
                HttpRequest request = HttpRequest.newBuilder(uri)
                        .timeout(Duration.ofSeconds(6))
                        .header("User-Agent", "RippleChatBot/1.0 (+link preview)")
                        .header("Accept", "text/html")
                        .GET()
                        .build();
                HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
                int code = response.statusCode();
                if (code >= 300 && code < 400) {
                    String location = response.headers().firstValue("location").orElse(null);
                    response.body().close();
                    if (location == null) {
                        return null;
                    }
                    uri = uri.resolve(location);
                    continue;
                }
                if (code != 200) {
                    response.body().close();
                    return null;
                }
                String contentType = response.headers().firstValue("content-type").orElse("").toLowerCase();
                if (!contentType.isEmpty() && !contentType.contains("html")) {
                    response.body().close();
                    return null;
                }
                String html = readCapped(response.body());
                return parse(html, uri.toString());
            }
            return null;
        } catch (Exception e) {
            log.debug("link preview failed for {}: {}", rawUrl, e.getMessage());
            return null;
        }
    }

    private String readCapped(InputStream in) throws IOException {
        try (in) {
            return new String(in.readNBytes(MAX_BODY_BYTES), StandardCharsets.UTF_8);
        }
    }

    private LinkPreview parse(String html, String baseUrl) {
        Document doc = Jsoup.parse(html, baseUrl);
        String title = firstNonBlank(metaContent(doc, "og:title"), doc.title());
        String description = firstNonBlank(metaContent(doc, "og:description"), metaContent(doc, "description"));
        String image = absImage(doc);
        String siteName = metaContent(doc, "og:site_name");
        if (isBlank(title) && isBlank(description) && image == null) {
            return null;
        }
        return new LinkPreview(baseUrl, cap(title, 200), cap(description, 300), image, cap(siteName, 100));
    }

    private String absImage(Document doc) {
        Element el = doc.selectFirst("meta[property=og:image]");
        if (el == null) {
            el = doc.selectFirst("meta[name=twitter:image]");
        }
        if (el == null) {
            return null;
        }
        String abs = el.absUrl("content");
        return abs.isBlank() ? null : abs;
    }

    private String metaContent(Document doc, String key) {
        Element el = doc.selectFirst("meta[property=" + key + "]");
        if (el == null) {
            el = doc.selectFirst("meta[name=" + key + "]");
        }
        return el == null ? null : el.attr("content");
    }

    /** Rejects non-http(s) schemes and private/loopback/link-local hosts (SSRF guard). */
    private boolean isAllowed(URI uri) {
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equals("http") || scheme.equals("https"))) {
            return false;
        }
        String host = uri.getHost();
        if (host == null) {
            return false;
        }
        try {
            for (InetAddress addr : InetAddress.getAllByName(host)) {
                if (addr.isLoopbackAddress() || addr.isAnyLocalAddress() || addr.isLinkLocalAddress()
                        || addr.isSiteLocalAddress() || addr.isMulticastAddress() || isUniqueLocalIpv6(addr)) {
                    return false;
                }
            }
        } catch (UnknownHostException e) {
            return false;
        }
        return true;
    }

    private boolean isUniqueLocalIpv6(InetAddress addr) {
        byte[] bytes = addr.getAddress();
        return bytes.length == 16 && (bytes[0] & 0xfe) == 0xfc; // fc00::/7
    }

    private String firstNonBlank(String a, String b) {
        return !isBlank(a) ? a : (!isBlank(b) ? b : null);
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private String cap(String s, int max) {
        if (s == null) {
            return null;
        }
        String trimmed = s.trim();
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }
}
