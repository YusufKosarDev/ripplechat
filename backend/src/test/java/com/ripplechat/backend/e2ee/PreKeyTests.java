package com.ripplechat.backend.e2ee;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class PreKeyTests extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void testUploadAndRetrievePreKeys() throws Exception {
        // 1. Create a user and mock public-key upload
        User alice = createUser("alice_e2e");
        alice.setPublicKey("alice_identity_public_ecdh_jwk");
        userRepository.saveAndFlush(alice);

        // Generate token for alice
        String registerBody = mvc.perform(post("/api/auth/login").contentType(APPLICATION_JSON)
                        .content("{\"login\":\"alice_e2e\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String aliceToken = com.jayway.jsonpath.JsonPath.read(registerBody, "$.accessToken");

        // 2. Upload prekeys
        PreKeyUploadRequest request = new PreKeyUploadRequest();
        request.setSignedPreKeyId(101);
        request.setSignedPreKeyPublic("alice_spk_jwk");
        request.setSignedPreKeySignature("alice_spk_signature");

        PreKeyUploadRequest.OneTimePreKeyDto otpk1 = new PreKeyUploadRequest.OneTimePreKeyDto();
        otpk1.setKeyId(201);
        otpk1.setPublicKey("alice_otpk1_jwk");

        PreKeyUploadRequest.OneTimePreKeyDto otpk2 = new PreKeyUploadRequest.OneTimePreKeyDto();
        otpk2.setKeyId(202);
        otpk2.setPublicKey("alice_otpk2_jwk");

        request.setOneTimePreKeys(List.of(otpk1, otpk2));

        mvc.perform(post("/api/e2ee/keys")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNoContent());

        // 3. Count remaining one-time prekeys
        mvc.perform(get("/api/e2ee/keys/count")
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.oneTimePreKeyCount").value(2));

        // 4. Retrieve prekey bundle as another user
        User bob = createUser("bob_e2e");
        String bobLogin = mvc.perform(post("/api/auth/login").contentType(APPLICATION_JSON)
                        .content("{\"login\":\"bob_e2e\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String bobToken = com.jayway.jsonpath.JsonPath.read(bobLogin, "$.accessToken");

        // Retrieve Alice's bundle (first time should consume otpk1 since it orders by keyId Asc)
        mvc.perform(get("/api/e2ee/keys/" + alice.getId())
                        .header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.identityKey").value("alice_identity_public_ecdh_jwk"))
                .andExpect(jsonPath("$.signedPreKeyId").value(101))
                .andExpect(jsonPath("$.signedPreKeyPublic").value("alice_spk_jwk"))
                .andExpect(jsonPath("$.signedPreKeySignature").value("alice_spk_signature"))
                .andExpect(jsonPath("$.oneTimePreKeyId").value(201))
                .andExpect(jsonPath("$.oneTimePreKeyPublic").value("alice_otpk1_jwk"));

        // Count should decrease to 1
        mvc.perform(get("/api/e2ee/keys/count")
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.oneTimePreKeyCount").value(1));

        // Retrieve Alice's bundle again (should consume otpk2)
        mvc.perform(get("/api/e2ee/keys/" + alice.getId())
                        .header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.oneTimePreKeyId").value(202))
                .andExpect(jsonPath("$.oneTimePreKeyPublic").value("alice_otpk2_jwk"));

        // Count should decrease to 0
        mvc.perform(get("/api/e2ee/keys/count")
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.oneTimePreKeyCount").value(0));

        // Retrieve Alice's bundle a third time (should have no oneTimePreKey left)
        mvc.perform(get("/api/e2ee/keys/" + alice.getId())
                        .header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.oneTimePreKeyId").value(nullValue()))
                .andExpect(jsonPath("$.oneTimePreKeyPublic").value(nullValue()));
    }
}
