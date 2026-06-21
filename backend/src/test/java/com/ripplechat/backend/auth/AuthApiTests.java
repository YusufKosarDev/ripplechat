package com.ripplechat.backend.auth;

import com.jayway.jsonpath.JsonPath;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.http.MediaType.APPLICATION_PROBLEM_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Exercises the real HTTP + Spring Security filter chain end to end. */
@AutoConfigureMockMvc
class AuthApiTests extends AbstractIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Test
    void registerReturns201WithToken() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON)
                        .content("{\"username\":\"web1\",\"email\":\"web1@test.io\",\"password\":\"password123\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    void registerRejectsInvalidPayloadWith400() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON)
                        .content("{\"username\":\"\",\"email\":\"not-an-email\",\"password\":\"short\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validationErrorIsAnRfc7807ProblemWithFieldErrors() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON)
                        .content("{\"username\":\"\",\"email\":\"not-an-email\",\"password\":\"short\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("Validation failed"))
                .andExpect(jsonPath("$.instance").value("/api/auth/register"))
                .andExpect(jsonPath("$.fieldErrors").isNotEmpty());
    }

    @Test
    void protectedEndpointRequiresToken() throws Exception {
        mvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpointWorksWithToken() throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON)
                        .content("{\"username\":\"web2\",\"email\":\"web2@test.io\",\"password\":\"password123\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(body, "$.accessToken");

        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("web2"));
    }
}
