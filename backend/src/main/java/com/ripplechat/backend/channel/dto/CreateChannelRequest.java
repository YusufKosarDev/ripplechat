package com.ripplechat.backend.channel.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateChannelRequest(

        @NotBlank(message = "name is required")
        String name,

        String description,

        Boolean isPrivate
) {
}
