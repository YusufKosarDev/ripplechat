package com.ripplechat.backend.channel.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateChannelRequest(

        @NotBlank(message = "name is required")
        String name,

        String description
) {
}
