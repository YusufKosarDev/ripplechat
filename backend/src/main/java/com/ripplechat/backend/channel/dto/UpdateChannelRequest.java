package com.ripplechat.backend.channel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateChannelRequest(

        @NotBlank(message = "name is required")
        @Size(max = 80, message = "name must be at most 80 characters")
        String name,

        @Size(max = 500, message = "description must be at most 500 characters")
        String description
) {
}
