package com.ripplechat.backend.media;

import com.cloudinary.Cloudinary;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires {@link MediaStorage}. Cloudinary is used when {@code CLOUDINARY_URL}
 * (cloudinary://key:secret@cloud) is set; otherwise uploads are disabled so the
 * app still boots locally and in tests without credentials.
 */
@Configuration
public class MediaStorageConfig {

    private static final Logger log = LoggerFactory.getLogger(MediaStorageConfig.class);

    @Bean
    public MediaStorage mediaStorage(@Value("${CLOUDINARY_URL:}") String cloudinaryUrl) {
        if (cloudinaryUrl == null || cloudinaryUrl.isBlank()) {
            log.info("CLOUDINARY_URL not set — image uploads are disabled");
            return new DisabledMediaStorage();
        }
        log.info("Cloudinary media storage enabled");
        return new CloudinaryMediaStorage(new Cloudinary(cloudinaryUrl));
    }
}
