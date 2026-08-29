package com.ripplechat.backend.search;

import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Which backend you get when nothing says.
 *
 * <p>Deliberately sets no property: that is the whole point. {@code
 * application.properties} and the README both describe PostgreSQL as the
 * default and Elasticsearch as opt-in, but the decision is really made by
 * {@code matchIfMissing}, and it used to sit on the Elasticsearch
 * implementation — so "no property" meant Elasticsearch, and every test that
 * did not pin a backend had been running against one the documentation calls
 * opt-in. Production never noticed because the property is always set there,
 * which is exactly why nothing caught it.
 */
class SearchBackendDefaultTest extends AbstractIntegrationTest {

    @Autowired
    MessageSearchIndex searchIndex;

    @Test
    void withNothingConfiguredSearchRunsOnPostgres() {
        assertThat(searchIndex).isInstanceOf(DatabaseMessageSearchIndex.class);
    }

    @Test
    void andThatBackendDoesNotAskToBeToldAboutChanges() {
        // The rows are the index, so there is nothing to keep in step — and
        // nothing should be queued on the outbox to do it.
        assertThat(searchIndex.requiresIndexing()).isFalse();
    }
}
