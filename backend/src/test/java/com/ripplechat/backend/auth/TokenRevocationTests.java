package com.ripplechat.backend.auth;

import com.ripplechat.backend.admin.AdminService;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Access tokens are stateless JWTs, so ending a session used to mean "you may
 * not get a new one" rather than "the one you have stops working". These cover
 * the watermark that closes that hour-wide window.
 */
@AutoConfigureMockMvc
class TokenRevocationTests extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private AdminService adminService;
    @Autowired
    private AuthService authService;

    @Test
    void banningAnAccountKillsItsAccessTokenImmediately() throws Exception {
        User victim = createUser("banned_user");
        User admin = createUser("ban_admin");
        admin.setAdmin(true);
        userRepository.saveAndFlush(admin);

        String token = login("banned_user");
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        adminService.setDisabled("ban_admin", victim.getId(), true);

        // Previously the ban only dropped the refresh token, so this still
        // returned 200 for the rest of the token's lifetime.
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void signingOutKillsTheAccessTokenNotJustTheRefreshToken() throws Exception {
        createUser("bye_user");

        String body = loginBody("bye_user");
        String accessToken = com.jayway.jsonpath.JsonPath.read(body, "$.accessToken");
        String refreshToken = com.jayway.jsonpath.JsonPath.read(body, "$.refreshToken");

        authService.logout(refreshToken);

        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aTokenIssuedAfterTheRevocationStillWorks() throws Exception {
        createUser("again_user");

        String first = login("again_user");
        authService.logout(com.jayway.jsonpath.JsonPath.read(loginBody("again_user"), "$.refreshToken"));

        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + first))
                .andExpect(status().isUnauthorized());

        // The watermark must not shadow the session the user opens next. It sits
        // at the second after the sign-out, and iat has one-second granularity,
        // so a genuinely later token has to be minted in a later second.
        Thread.sleep(1100);
        String fresh = login("again_user");
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + fresh))
                .andExpect(status().isOk());
    }

    private String login(String username) throws Exception {
        return com.jayway.jsonpath.JsonPath.read(loginBody(username), "$.accessToken");
    }

    private String loginBody(String username) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(APPLICATION_JSON)
                        .content("{\"login\":\"" + username + "\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }
}
