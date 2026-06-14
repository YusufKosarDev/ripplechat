package com.ripplechat.backend.gif;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * GIF search via the Giphy API. Disabled (returns no results) when GIPHY_API_KEY
 * is not configured.
 */
@Service
public class GifService {

    private static final Logger log = LoggerFactory.getLogger(GifService.class);

    private final String apiKey;
    private final ObjectMapper objectMapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public GifService(@Value("${GIPHY_API_KEY:}") String apiKey, ObjectMapper objectMapper) {
        this.apiKey = apiKey;
        this.objectMapper = objectMapper;
    }

    public boolean isEnabled() {
        return apiKey != null && !apiKey.isBlank();
    }

    public List<Gif> search(String query) {
        if (!isEnabled() || query == null || query.isBlank()) {
            return List.of();
        }
        try {
            String url = "https://api.giphy.com/v1/gifs/search?api_key=" + enc(apiKey)
                    + "&q=" + enc(query.trim()) + "&limit=24&rating=pg-13";
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .GET()
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                return List.of();
            }
            JsonNode root = objectMapper.readTree(response.body());
            List<Gif> gifs = new ArrayList<>();
            for (JsonNode item : root.path("data")) {
                JsonNode images = item.path("images");
                String full = images.path("downsized").path("url").asText(null);
                String preview = images.path("fixed_width_small").path("url").asText(full);
                if (full != null && !full.isBlank()) {
                    gifs.add(new Gif(full, preview));
                }
            }
            return gifs;
        } catch (Exception e) {
            log.debug("GIF search failed: {}", e.getMessage());
            return List.of();
        }
    }

    private String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
