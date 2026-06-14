package com.ripplechat.backend.gif;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Unit test for the disabled (no API key) path — no network. */
class GifServiceTest {

    private final GifService service = new GifService("", new ObjectMapper());

    @Test
    void disabledWithoutApiKey() {
        assertThat(service.isEnabled()).isFalse();
        assertThat(service.search("cat")).isEmpty();
    }
}
