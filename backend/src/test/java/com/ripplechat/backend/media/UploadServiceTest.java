package com.ripplechat.backend.media;

import com.ripplechat.backend.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Unit tests for upload validation with a stubbed storage (no Cloudinary). */
class UploadServiceTest {

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
    });

    private static byte[] pngBytes() {
        return new byte[] {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 13};
    }

    @Test
    void uploadsAValidImage() {
        var file = new MockMultipartFile("file", "x.png", "image/png", pngBytes());
        assertThat(service.uploadImage(file)).startsWith("https://res.cloudinary.com/");
    }

    @Test
    void acceptsJpegAndWebpSignatures() {
        var jpeg = new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, (byte) 0xe0, 0, 0, 0, 0, 0, 0, 0, 0};
        var webp = new byte[] {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'};
        assertThat(service.uploadImage(new MockMultipartFile("file", "a.jpg", "image/jpeg", jpeg))).isNotBlank();
        assertThat(service.uploadImage(new MockMultipartFile("file", "a.webp", "image/webp", webp))).isNotBlank();
    }

    @Test
    void rejectsCorruptBytesLabelledAsAnImageWith400NotACloudinary500() {
        var file = new MockMultipartFile("file", "x.png", "image/png", new byte[] {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12});
        assertThatThrownBy(() -> service.uploadImage(file))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("not a valid image");
    }

    @Test
    void svgIsExemptFromTheRasterSignatureCheck() {
        var svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes();
        var file = new MockMultipartFile("file", "a.svg", "image/svg+xml", svg);
        assertThat(service.uploadImage(file)).isNotBlank();
    }

    @Test
    void rejectsNonImageContentType() {
        var file = new MockMultipartFile("file", "doc.pdf", "application/pdf", pngBytes());
        assertThatThrownBy(() -> service.uploadImage(file)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsEmptyFile() {
        var file = new MockMultipartFile("file", "x.png", "image/png", new byte[0]);
        assertThatThrownBy(() -> service.uploadImage(file)).isInstanceOf(BadRequestException.class);
    }
}
