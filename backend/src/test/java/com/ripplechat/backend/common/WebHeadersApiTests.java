package com.ripplechat.backend.common;

import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

/**
 * Verifies the cross-cutting HTTP concerns through the real filter chain: the
 * security response headers and the request-id correlation header.
 * (HSTS is asserted in production only — Spring emits it for secure requests,
 * which MockMvc requests are not.)
 */
@AutoConfigureMockMvc
class WebHeadersApiTests extends AbstractIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Test
    void securityHeadersArePresent() throws Exception {
        mvc.perform(get("/api/users/me")) // 401, but headers are still applied
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"))
                .andExpect(header().string("Content-Security-Policy", "frame-ancestors 'none'"));
    }

    @Test
    void generatesARequestIdHeader() throws Exception {
        mvc.perform(get("/api/users/me"))
                .andExpect(header().exists(RequestIdFilter.REQUEST_ID_HEADER));
    }

    @Test
    void echoesAnInboundRequestId() throws Exception {
        mvc.perform(get("/api/users/me").header(RequestIdFilter.REQUEST_ID_HEADER, "trace-abc"))
                .andExpect(header().string(RequestIdFilter.REQUEST_ID_HEADER, "trace-abc"));
    }
}
