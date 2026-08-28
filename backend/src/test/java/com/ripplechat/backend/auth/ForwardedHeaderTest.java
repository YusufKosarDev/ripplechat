package com.ripplechat.backend.auth;

import com.ripplechat.backend.support.SharedContainers;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The client address the application records must be one the client cannot
 * choose. It is what the registration and password-reset throttles are keyed on,
 * and what the active-sessions list shows.
 *
 * <p>Reading {@code X-Forwarded-For} by hand took the first entry — the part a
 * caller writes for themselves, since a proxy appends rather than replaces.
 * Production hands the job to Tomcat's {@code RemoteIpValve}, which walks the
 * list from the right and skips trusted proxies. That valve needs a real servlet
 * container, so this runs on a random port over real HTTP; MockMvc would not
 * exercise it at all.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "server.forward-headers-strategy=NATIVE",
        // Both requests here register from the same address, and the buckets live
        // in a Redis shared with every other test class. This class does not
        // extend AbstractIntegrationTest — it needs its own web environment — so
        // it does not get that base class's per-test reset; giving it its own
        // budget makes it independent of what ran before it.
        "app.security.register.burst=100",
        "app.security.register.refill-per-second=50",
})
class ForwardedHeaderTest {

    @DynamicPropertySource
    static void containerProperties(DynamicPropertyRegistry registry) {
        SharedContainers.apply(registry);
    }

    @LocalServerPort
    int port;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void theRecordedClientAddressComesFromTheProxyHeaderNotTheCaller() throws Exception {
        // 127.0.0.1 is in Tomcat's default trusted-proxy set, so the valve treats
        // this connection as a proxy hop and resolves the address from the header.
        assertThat(recordedAddressFor("fwd" + System.nanoTime(), "203.0.113.9"))
                .isEqualTo("203.0.113.9");
    }

    @Test
    void withoutTheHeaderTheConnectionAddressIsUsed() throws Exception {
        assertThat(recordedAddressFor("noh" + System.nanoTime(), null))
                .isIn("127.0.0.1", "0:0:0:0:0:0:0:1", "::1");
    }

    /** Registers over real HTTP, then reads the address the session recorded. */
    private String recordedAddressFor(String username, String forwardedFor) throws Exception {
        HttpRequest.Builder register = HttpRequest.newBuilder(uri("/api/auth/register"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"username\":\"" + username + "\",\"email\":\"" + username
                                + "@fwd.test\",\"password\":\"password123\"}"));
        if (forwardedFor != null) {
            register.header("X-Forwarded-For", forwardedFor);
        }
        HttpResponse<String> registered = http.send(register.build(), HttpResponse.BodyHandlers.ofString());
        assertThat(registered.statusCode()).isEqualTo(201);

        String accessToken = com.jayway.jsonpath.JsonPath.read(registered.body(), "$.accessToken");
        HttpResponse<String> sessions = http.send(
                HttpRequest.newBuilder(uri("/api/auth/sessions"))
                        .header("Authorization", "Bearer " + accessToken)
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(sessions.statusCode()).isEqualTo(200);
        return com.jayway.jsonpath.JsonPath.read(sessions.body(), "$[0].ipAddress");
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }
}
