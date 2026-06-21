package com.ripplechat.backend.common;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Application caching, backed by Caffeine. Currently holds the
 * {@code linkPreviews} cache: link-unfurl results expire after an hour (so
 * previews stay reasonably fresh) and are size-bounded with LRU eviction.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    public static final String LINK_PREVIEWS = "linkPreviews";

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(LINK_PREVIEWS);
        manager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(Duration.ofHours(1)));
        return manager;
    }
}
