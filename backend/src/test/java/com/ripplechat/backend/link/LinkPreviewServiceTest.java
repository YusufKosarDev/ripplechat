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

}
