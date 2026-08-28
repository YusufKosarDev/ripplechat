package com.ripplechat.backend.media;

import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.redis.RateLimiter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;

/** Unit tests for upload validation with a stubbed storage (no Cloudinary). */
class UploadServiceTest {

    private static final String USER = "uploader";

    /** Always-allows by default; individual tests override it to test the throttle. */
    private final RateLimiter rateLimiter = Mockito.mock(RateLimiter.class);

    private final UploadService service = new UploadService(new MediaStorage() {
        @Override
        public boolean isEnabled() {
            return true;
        }

        @Override
        public String uploadImage(byte[] bytes) {
            return "https://res.cloudinary.com/demo/image/upload/x.png";
        }

        @Override
        public String uploadFile(byte[] bytes) {
            return "https://res.cloudinary.com/demo/raw/upload/x.pdf";
        }

        @Override
        public boolean delete(String url) {
            return true;
        }
    }, rateLimiter);

    @BeforeEach
    void allowUploadsByDefault() {
        Mockito.when(rateLimiter.tryAcquire(anyString(), anyDouble(), anyDouble())).thenReturn(true);
    }

    private static byte[] pngBytes() {
        return new byte[] {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 13};
    }

    @Test
    void uploadsAValidImage() {
        var file = new MockMultipartFile("file", "x.png", "image/png", pngBytes());
        assertThat(service.uploadImage(USER, file)).startsWith("https://res.cloudinary.com/");
    }

    @Test
    void acceptsJpegAndWebpSignatures() {
        var jpeg = new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, (byte) 0xe0, 0, 0, 0, 0, 0, 0, 0, 0};
        var webp = new byte[] {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'};
        assertThat(service.uploadImage(USER, new MockMultipartFile("file", "a.jpg", "image/jpeg", jpeg))).isNotBlank();
        assertThat(service.uploadImage(USER, new MockMultipartFile("file", "a.webp", "image/webp", webp))).isNotBlank();
    }

    @Test
    void rejectsCorruptBytesLabelledAsAnImageWith400NotACloudinary500() {
        var file = new MockMultipartFile("file", "x.png", "image/png", new byte[] {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12});
        assertThatThrownBy(() -> service.uploadImage(USER, file))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("not a valid image");
    }

    @Test
    void rejectsSvgWhichIsAScriptContainerNotAPicture() {
        var svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes();
        // SVG used to be waved past the signature check for being text, which
        // made it the one "image" that could carry active content to the CDN.
        assertThatThrownBy(() -> service.uploadImage(USER, new MockMultipartFile("file", "a.svg", "image/svg+xml", svg)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.uploadFile(USER, new MockMultipartFile("file", "a.svg", "image/svg+xml", svg)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsNonImageContentType() {
        var file = new MockMultipartFile("file", "doc.pdf", "application/pdf", pngBytes());
        assertThatThrownBy(() -> service.uploadImage(USER, file)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsEmptyFile() {
        var file = new MockMultipartFile("file", "x.png", "image/png", new byte[0]);
        assertThatThrownBy(() -> service.uploadImage(USER, file)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void fileUploadRejectsActiveContentButKeepsOpaqueCiphertext() {
        assertThat(service.uploadFile(USER, new MockMultipartFile("file", "a.pdf", "application/pdf", pngBytes())))
                .isNotBlank();
        // An E2EE attachment arrives as opaque ciphertext, so arbitrary bytes
        // have to stay acceptable — an allow-list here would break encrypted
        // attachments outright.
        assertThat(service.uploadFile(USER,
                new MockMultipartFile("file", "enc", "application/octet-stream", pngBytes())))
                .isNotBlank();
        // What must not get through is anything the media host would render as
        // active content.
        assertThatThrownBy(() -> service.uploadFile(USER,
                new MockMultipartFile("file", "a.html", "text/html", "<script>alert(1)</script>".getBytes())))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("not allowed");
    }

    @Test
    void uploadsAreThrottledPerUser() {
        Mockito.when(rateLimiter.tryAcquire(anyString(), anyDouble(), anyDouble())).thenReturn(false);
        var file = new MockMultipartFile("file", "x.png", "image/png", pngBytes());

        assertThatThrownBy(() -> service.uploadImage(USER, file))
                .isInstanceOf(ResponseStatusException.class)
                .matches(ex -> ((ResponseStatusException) ex).getStatusCode().value() == 429);
    }
}
