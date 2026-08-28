package com.ripplechat.backend.auth;

import com.jayway.jsonpath.JsonPath;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.http.MediaType.APPLICATION_PROBLEM_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Exercises the real HTTP + Spring Security filter chain end to end. */
@AutoConfigureMockMvc
class AuthApiTests extends AbstractIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Test
    void providersReportsGoogleWhenAClientIdIsConfigured() throws Exception {
        // The test profile configures a real-looking client id; production
        // with the placeholder returns false, hiding the button.
        mvc.perform(get("/api/auth/providers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.google").value(true));
    }

    @Test
    void registerReturns201WithToken() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON)
                        .content("{\"username\":\"web1\",\"email\":\"web1@test.io\",\"password\":\"password123\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    void registerRejectsAUsernameShapedLikeAnEmailAddress() throws Exception {
        // Sign-in accepts a username or an email, so a username that looks like
        // someone else's address made their email sign-in ambiguous — the lookup
        // matched two rows and failed outright.
        mvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON)
                        .content("{\"username\":\"victim@test.io\",\"email\":\"attacker@test.io\","
                                + "\"password\":\"password123\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("username"));
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
    void unauthenticatedRequestReturnsRfc7807Problem() throws Exception {
        mvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.detail").value("Authentication required"))
                .andExpect(jsonPath("$.instance").value("/api/users/me"));
    }

    @Test
    void throttledLoginReturns429WithRetryAfter() throws Exception {
        String body = "{\"login\":\"nobody-throttle\",\"password\":\"x\"}";
        // The login burst is 5; the 6th attempt for the same identifier is throttled.
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/login").contentType(APPLICATION_JSON).content(body));
        }
        mvc.perform(post("/api/auth/login").contentType(APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
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
