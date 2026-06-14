package com.ripplechat.backend.link;

import org.junit.jupiter.api.Test;

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
}
