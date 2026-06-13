package com.ripplechat.backend.read;

import com.ripplechat.backend.read.dto.ReadReceipt;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/channels/{channelId}/reads")
@RequiredArgsConstructor
public class ReadReceiptController {

    private final ReadReceiptService readReceiptService;

    @GetMapping
    public List<ReadReceipt> list(@PathVariable UUID channelId,
                                  @AuthenticationPrincipal String username) {
        return readReceiptService.listReads(channelId, username);
    }
}
