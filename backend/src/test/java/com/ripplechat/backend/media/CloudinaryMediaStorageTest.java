package com.ripplechat.backend.media;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

class CloudinaryMediaStorageTest {

    @Test
    void parsesUrlsAndCallsDestroy() throws Exception {
        Cloudinary cloudinary = Mockito.mock(Cloudinary.class);
        Uploader uploader = Mockito.mock(Uploader.class);
        when(cloudinary.uploader()).thenReturn(uploader);

        CloudinaryMediaStorage storage = new CloudinaryMediaStorage(cloudinary);

        // Mock destroy for image
        when(uploader.destroy(eq("ripplechat/abc"), anyMap()))
                .thenReturn(Map.of("result", "ok"));

        // Mock destroy for raw file
        when(uploader.destroy(eq("ripplechat/doc.pdf"), anyMap()))
                .thenReturn(Map.of("result", "ok"));

        // Mock destroy for video
        when(uploader.destroy(eq("ripplechat/audio"), anyMap()))
                .thenReturn(Map.of("result", "not_found"));

        boolean imageDeleted = storage.delete("https://res.cloudinary.com/cloudname/image/upload/v12345/ripplechat/abc.jpg");
        boolean rawDeleted = storage.delete("https://res.cloudinary.com/cloudname/raw/upload/v67890/ripplechat/doc.pdf");
        boolean videoDeleted = storage.delete("https://res.cloudinary.com/cloudname/video/upload/v999/ripplechat/audio.webm");
        boolean invalidUrl = storage.delete("https://res.cloudinary.com/cloudname/something/invalid");
        boolean nonCloudinary = storage.delete("https://example.com/some/file.png");

        assertThat(imageDeleted).isTrue();
        assertThat(rawDeleted).isTrue();
        assertThat(videoDeleted).isTrue(); // "not_found" is mapped to true
        assertThat(invalidUrl).isFalse();
        assertThat(nonCloudinary).isFalse();
    }
}
