package com.ripplechat.backend.ai;

import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiSummaryTests extends AbstractIntegrationTest {

    @Autowired
    AiSummaryService aiSummaryService;

    @Test
    void isDisabledWithoutAnApiKey() {
        // No ANTHROPIC_API_KEY in the test environment, so the feature is off.
        assertThat(aiSummaryService.isEnabled()).isFalse();
    }

    @Test
    void summarizingWhileDisabledReturns503() {
        createUser("alice");
        assertThatThrownBy(() -> aiSummaryService.summarizeChannel(UUID.randomUUID(), "alice"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }
}
