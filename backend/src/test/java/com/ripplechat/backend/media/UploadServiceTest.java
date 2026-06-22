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

    @Test
    void uploadsAValidImage() {
        var file = new MockMultipartFile("file", "x.png", "image/png", new byte[] {1, 2, 3});
        assertThat(service.uploadImage(file)).startsWith("https://res.cloudinary.com/");
    }

    @Test
    void rejectsNonImageContentType() {
        var file = new MockMultipartFile("file", "doc.pdf", "application/pdf", new byte[] {1, 2, 3});
        assertThatThrownBy(() -> service.uploadImage(file)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsEmptyFile() {
        var file = new MockMultipartFile("file", "x.png", "image/png", new byte[0]);
        assertThatThrownBy(() -> service.uploadImage(file)).isInstanceOf(BadRequestException.class);
    }
}
