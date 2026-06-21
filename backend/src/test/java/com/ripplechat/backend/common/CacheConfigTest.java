package com.ripplechat.backend.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Loads only the cache configuration (no datasource/web), so it verifies the
 * link-preview cache is wired without needing the full application context.
 */
@SpringBootTest(classes = CacheConfig.class)
class CacheConfigTest {

    @Autowired
    CacheManager cacheManager;

    @Test
    void linkPreviewCacheIsConfigured() {
        assertThat(cacheManager.getCacheNames()).contains(CacheConfig.LINK_PREVIEWS);
        assertThat(cacheManager.getCache(CacheConfig.LINK_PREVIEWS)).isNotNull();
    }
}
