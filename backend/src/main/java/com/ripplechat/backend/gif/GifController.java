package com.ripplechat.backend.gif;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/gifs")
@RequiredArgsConstructor
public class GifController {

    private final GifService gifService;

    /** Searches GIFs; {@code enabled} is false when no Giphy key is configured. */
    @GetMapping("/search")
    public Map<String, Object> search(@RequestParam(value = "q", required = false, defaultValue = "") String q) {
        return Map.of("enabled", gifService.isEnabled(), "results", gifService.search(q));
    }
}
