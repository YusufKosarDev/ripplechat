package com.ripplechat.backend.common;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/** Unit tests for the request-id correlation filter — no Spring context. */
class RequestIdFilterTest {

    private final RequestIdFilter filter = new RequestIdFilter();

    @Test
    void generatesAnIdWhenNoneIsSupplied() throws Exception {
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getHeader(RequestIdFilter.REQUEST_ID_HEADER)).isNotBlank();
    }

    @Test
    void honoursAnInboundRequestId() throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader(RequestIdFilter.REQUEST_ID_HEADER, "trace-123");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getHeader(RequestIdFilter.REQUEST_ID_HEADER)).isEqualTo("trace-123");
    }

    @Test
    void clearsTheMdcAfterTheRequest() throws Exception {
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();

        // The id is present during the chain and removed afterwards, so it never
        // leaks onto a pooled thread serving a later request.
        filter.doFilter(request, response, new MockFilterChain());

        assertThat(MDC.get("requestId")).isNull();
    }

    @Test
    void capsAnOverlongInboundId() throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader(RequestIdFilter.REQUEST_ID_HEADER, "x".repeat(200));
        var response = new MockHttpServletResponse();

        assertThatCode(() -> filter.doFilter(request, response, new MockFilterChain()))
                .doesNotThrowAnyException();
        assertThat(response.getHeader(RequestIdFilter.REQUEST_ID_HEADER)).hasSize(64);
    }
}
