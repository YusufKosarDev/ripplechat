package com.ripplechat.backend.common;

import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Verifies /actuator/info exposes build metadata (from build-info.properties). */
@AutoConfigureMockMvc
class ActuatorInfoApiTests extends AbstractIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Test
    void infoEndpointExposesBuildVersion() throws Exception {
        mvc.perform(get("/actuator/info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.build.version").exists())
                .andExpect(jsonPath("$.build.artifact").value("backend"));
    }
}
