package com.ripplechat.backend.common;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI metadata + a JWT bearer scheme, so Swagger UI shows an "Authorize"
 * button where a token can be pasted to call protected endpoints.
 */
@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearer-jwt";

    @Bean
    public OpenAPI ripplechatOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("RippleChat API")
                        .version("v1")
                        .description("Real-time messaging API — auth, channels, messages, threads, "
                                + "reactions, polls, presence and search."))
                .addSecurityItem(new SecurityRequirement().addList(BEARER))
                .components(new Components().addSecuritySchemes(BEARER,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}
