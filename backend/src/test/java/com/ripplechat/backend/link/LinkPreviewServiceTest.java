package com.ripplechat.backend.link;

import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

/** Unit tests for the SSRF guard (no network — blocked hosts are rejected before any request). */
class LinkPreviewServiceTest {

    private final LinkPreviewService service = new LinkPreviewService();

    @Test
    void rejectsNonHttpSchemes() {
        assertThat(service.preview("ftp://example.com/file")).isNull();
        assertThat(service.preview("file:///etc/passwd")).isNull();
    }

    @Test
    void rejectsLoopbackAndPrivateAndMetadataHosts() {
        assertThat(service.preview("http://localhost/")).isNull();
        assertThat(service.preview("http://127.0.0.1/")).isNull();
        assertThat(service.preview("http://10.0.0.1/")).isNull();
        assertThat(service.preview("http://192.168.1.1/")).isNull();
        assertThat(service.preview("http://169.254.169.254/latest/meta-data/")).isNull();
    }

    @Test
    void rejectsBlankInput() {
        assertThat(service.preview("")).isNull();
        assertThat(service.preview(null)).isNull();
    }

    @Test
    void rejectsNonStandardPortsToPreventInternalPortScanning() {
        assertThat(service.preview("http://93.184.216.34:8080/")).isNull();
        assertThat(service.preview("http://93.184.216.34:22/")).isNull();
        assertThat(service.preview("http://93.184.216.34:8443/")).isNull();
    }

    @Test
    void rejectsWildcardAndMulticastAddresses() {
        assertThat(service.preview("http://0.0.0.0/")).isNull();
        assertThat(service.preview("http://224.0.0.1/")).isNull();
    }

    @Test
    void rejectsIpv6LoopbackLinkLocalAndUniqueLocal() {
        assertThat(service.preview("http://[::1]/")).isNull();
        assertThat(service.preview("http://[fe80::1]/")).isNull();
        // Both halves of the fc00::/7 unique-local range, so a mutated mask
        // ((bytes[0] & 0xfe) == 0xfc) cannot survive.
        assertThat(service.preview("http://[fc00::1]/")).isNull();
        assertThat(service.preview("http://[fd12:3456::1]/")).isNull();
    }

    @Test
    void rejectsAUriWithNoHost() {
        // URI.create accepts these; getHost() is null and the guard must say no.
        assertThat(service.preview("http:///etc/passwd")).isNull();
        assertThat(service.preview("http://")).isNull();
    }

    @Test
    void rejectsAHostThatDoesNotResolve() {
        // .invalid is reserved by RFC 2606, so this never resolves and is safe in CI.
        assertThat(service.preview("http://nowhere.invalid/page")).isNull();
    }

    /**
     * The rejected-port cases above cannot tell a working guard from one that
     * rejects every port, so assert the allowed side too: a mutant flipping
     * {@code port != 80} would otherwise survive while breaking all real traffic.
     */
    @Test
    void standardPortsPassThePortCheck() {
        for (String url : new String[] {
                "http://127.0.0.1:80/", "https://127.0.0.1:443/", "http://127.0.0.1/" }) {
            // Still null overall — 127.0.0.1 is loopback — but reaching the host
            // check at all proves the port check let it through. An unsupported
            // port short-circuits before DNS.
            assertThat(service.preview(url)).as(url).isNull();
            assertThat(service.isAllowed(URI.create(url))).as(url).isFalse();
        }
        // A public address on a standard port passes every check up to DNS.
        assertThat(service.isAllowed(URI.create("https://example.com:443/"))).isTrue();
        assertThat(service.isAllowed(URI.create("http://example.com/"))).isTrue();
        // The same host on a non-standard port must not.
        assertThat(service.isAllowed(URI.create("https://example.com:8443/"))).isFalse();
    }

    // ─── Parsing ───────────────────────────────────────────────────────
    // parse() and its helpers were unreachable from preview() in tests, because
    // the SSRF guard blocks every host a test could stand up. Exercised directly
    // instead: no network, and it covers the half of the class that had none.

    private static final String BASE = "https://example.com/article";

    @Test
    void parsesOpenGraphTagsIntoAPreview() {
        LinkPreview p = service.parse("""
                <html><head>
                  <meta property="og:title" content="A title">
                  <meta property="og:description" content="A description">
                  <meta property="og:image" content="/cover.png">
                  <meta property="og:site_name" content="Example">
                </head><body></body></html>
                """, BASE);
        assertThat(p).isNotNull();
        assertThat(p.title()).isEqualTo("A title");
        assertThat(p.description()).isEqualTo("A description");
        assertThat(p.image()).isEqualTo("https://example.com/cover.png");
        assertThat(p.siteName()).isEqualTo("Example");
        assertThat(p.url()).isEqualTo(BASE);
    }

    @Test
    void fallsBackToTheDocumentTitleAndMetaDescription() {
        LinkPreview p = service.parse("""
                <html><head>
                  <title>Document title</title>
                  <meta name="description" content="Meta description">
                </head><body></body></html>
                """, BASE);
        assertThat(p).isNotNull();
        assertThat(p.title()).isEqualTo("Document title");
        assertThat(p.description()).isEqualTo("Meta description");
        assertThat(p.image()).isNull();
    }

    @Test
    void returnsNullWhenThereIsNothingWorthShowing() {
        assertThat(service.parse("<html><head></head><body>text</body></html>", BASE)).isNull();
    }

    /** One assertion per branch of absImage — including the twitter:image fallback. */
    @Test
    void prefersOgImageThenFallsBackToTwitterImage() {
        assertThat(service.absImage(Jsoup.parse(
                "<meta property=\"og:image\" content=\"/a.png\"><meta name=\"twitter:image\" content=\"/b.png\">", BASE)))
                .isEqualTo("https://example.com/a.png");

        assertThat(service.absImage(Jsoup.parse(
                "<meta name=\"twitter:image\" content=\"/b.png\">", BASE)))
                .as("twitter:image is the documented fallback")
                .isEqualTo("https://example.com/b.png");

        assertThat(service.absImage(Jsoup.parse("<html></html>", BASE))).isNull();

        // absUrl resolves an empty content against the base, so without an
        // explicit guard this returned the article's own URL as its image.
        assertThat(service.absImage(Jsoup.parse(
                "<meta property=\"og:image\" content=\"\">", BASE)))
                .as("a present but empty content attribute is not an image")
                .isNull();

        assertThat(service.absImage(Jsoup.parse(
                "<meta property=\"og:image\" content=\"\"><meta name=\"twitter:image\" content=\"/b.png\">", BASE)))
                .as("an empty og:image still falls through to twitter:image")
                .isEqualTo("https://example.com/b.png");
    }

    /** metaContent reads property= first, then name= — an easy pair to transpose. */
    @Test
    void metaContentReadsBothPropertyAndNameAttributes() {
        assertThat(service.metaContent(Jsoup.parse(
                "<meta property=\"og:title\" content=\"from property\">", BASE), "og:title"))
                .isEqualTo("from property");
        assertThat(service.metaContent(Jsoup.parse(
                "<meta name=\"og:title\" content=\"from name\">", BASE), "og:title"))
                .isEqualTo("from name");
        assertThat(service.metaContent(Jsoup.parse("<html></html>", BASE), "og:title")).isNull();
    }

    @Test
    void capTrimsAndTruncatesAtTheBoundary() {
        assertThat(service.cap(null, 5)).isNull();
        assertThat(service.cap("  padded  ", 20)).isEqualTo("padded");
        assertThat(service.cap("12345", 5)).as("exactly at the limit is kept whole").isEqualTo("12345");
        assertThat(service.cap("123456", 5)).as("one over is truncated").isEqualTo("12345");
    }

    @Test
    void firstNonBlankPrefersTheFirstArgument() {
        assertThat(service.firstNonBlank("a", "b")).isEqualTo("a");
        assertThat(service.firstNonBlank("  ", "b")).isEqualTo("b");
        assertThat(service.firstNonBlank(null, "b")).isEqualTo("b");
        assertThat(service.firstNonBlank(null, "   ")).isNull();
    }

    @Test
    void isBlankTreatsNullAndWhitespaceAlike() {
        assertThat(service.isBlank(null)).isTrue();
        assertThat(service.isBlank("")).isTrue();
        assertThat(service.isBlank("   ")).isTrue();
        assertThat(service.isBlank("x")).isFalse();
    }
}
