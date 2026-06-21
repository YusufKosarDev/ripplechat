package com.ripplechat.backend.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.info.ProjectInfoAutoConfiguration;
import org.springframework.boot.info.BuildProperties;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies build-info.properties is generated and bound to a {@link BuildProperties}
 * bean (which is what /actuator/info reports). Loads only the project-info
 * auto-configuration, so it needs no datasource/web (and no Docker).
 */
@SpringBootTest(classes = ProjectInfoAutoConfiguration.class)
class BuildInfoTest {

    @Autowired(required = false)
    BuildProperties buildProperties;

    @Test
    void buildPropertiesAreGeneratedAndBound() {
        assertThat(buildProperties).as("build-info.properties should be generated").isNotNull();
        assertThat(buildProperties.getArtifact()).isEqualTo("backend");
        assertThat(buildProperties.getVersion()).isNotBlank();
        assertThat(buildProperties.getTime()).isNotNull();
    }
}
