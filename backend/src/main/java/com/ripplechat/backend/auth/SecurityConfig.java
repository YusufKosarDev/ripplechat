package com.ripplechat.backend.auth;

import tools.jackson.databind.ObjectMapper;
import com.ripplechat.backend.auth.oauth2.HttpCookieOAuth2AuthorizationRequestRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.ripplechat.backend.auth.oauth2.CustomOAuth2UserService;
import com.ripplechat.backend.auth.oauth2.OAuth2AuthenticationFailureHandler;
import com.ripplechat.backend.auth.oauth2.OAuth2AuthenticationSuccessHandler;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /** Writes the 401/403 problem bodies. Stateless and thread-safe, so one is enough. */
    private static final ObjectMapper PROBLEM_MAPPER = new ObjectMapper();

    private final JwtService jwtService;
    private final TokenRevocationService tokenRevocationService;
    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2AuthenticationSuccessHandler oAuth2AuthenticationSuccessHandler;
    private final OAuth2AuthenticationFailureHandler oAuth2AuthenticationFailureHandler;
    private final HttpCookieOAuth2AuthorizationRequestRepository httpCookieOAuth2AuthorizationRequestRepository;

    public SecurityConfig(JwtService jwtService,
                          TokenRevocationService tokenRevocationService,
                          CustomOAuth2UserService customOAuth2UserService,
                          OAuth2AuthenticationSuccessHandler oAuth2AuthenticationSuccessHandler,
                          OAuth2AuthenticationFailureHandler oAuth2AuthenticationFailureHandler,
                          HttpCookieOAuth2AuthorizationRequestRepository httpCookieOAuth2AuthorizationRequestRepository) {
        this.jwtService = jwtService;
        this.tokenRevocationService = tokenRevocationService;
        this.customOAuth2UserService = customOAuth2UserService;
        this.oAuth2AuthenticationSuccessHandler = oAuth2AuthenticationSuccessHandler;
        this.oAuth2AuthenticationFailureHandler = oAuth2AuthenticationFailureHandler;
        this.httpCookieOAuth2AuthorizationRequestRepository = httpCookieOAuth2AuthorizationRequestRepository;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .headers(headers -> headers
                        // Defence in depth: nosniff and frame-deny are on by default;
                        // add HSTS, a referrer policy, and a CSP that forbids framing.
                        // The CSP intentionally only sets frame-ancestors so it does not
                        // break the Swagger UI this backend also serves.
                        .frameOptions(frame -> frame.deny())
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31_536_000))
                        .referrerPolicy(ref -> ref.policy(ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        .contentSecurityPolicy(csp -> csp.policyDirectives("frame-ancestors 'none'")))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        // Incoming webhooks authenticate via the secret token in the
                        // path, not a JWT, so the ingest endpoint is permit-listed.
                        .requestMatchers("/api/hooks/**").permitAll()
                        // The WebSocket handshake is open; STOMP CONNECT is authenticated
                        // separately via JWT in StompAuthChannelInterceptor.
                        .requestMatchers("/ws/**").permitAll()
                        // Public API docs and health.
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .anyRequest().authenticated())
                .oauth2Login(oauth2 -> oauth2
                        .authorizationEndpoint(authorization -> authorization
                                .authorizationRequestRepository(httpCookieOAuth2AuthorizationRequestRepository))
                        .userInfoEndpoint(userInfo -> userInfo
                                .userService(customOAuth2UserService))
                        .successHandler(oAuth2AuthenticationSuccessHandler)
                        .failureHandler(oAuth2AuthenticationFailureHandler))
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint(unauthorizedEntryPoint())
                        .accessDeniedHandler(accessDeniedHandler()))
                .addFilterBefore(new JwtAuthenticationFilter(jwtService, tokenRevocationService),
                        UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * CORS allowlist from {@code app.allowed-origins} (env APP_ALLOWED_ORIGINS).
     * Explicit origins only — no wildcard. Credentials are on to allow cross-origin
     * SockJS WebSocket connections.
     * In dev the frontend is same-origin via the Vite proxy, so CORS is inert.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.allowed-origins:}") String allowedOrigins) {
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /**
     * 401 for unauthenticated requests, as an RFC 7807 problem+json body so it
     * matches the shape produced by the global exception handler.
     */
    private AuthenticationEntryPoint unauthorizedEntryPoint() {
        return (request, response, authException) ->
                writeProblem(response, HttpStatus.UNAUTHORIZED, "Authentication required", request.getRequestURI());
    }

    /** 403 for authenticated-but-forbidden requests, also as problem+json. */
    private AccessDeniedHandler accessDeniedHandler() {
        return (request, response, ex) ->
                writeProblem(response, HttpStatus.FORBIDDEN, "Access denied", request.getRequestURI());
    }

    /**
     * Writes the problem document.
     *
     * <p>Serialised rather than assembled by hand. The instance is the request
     * URI, and the argument that it cannot break the JSON rested on Tomcat's
     * default refusal of quotes and backslashes in a request target — a
     * container setting, several layers away, that nothing here would notice
     * changing. A serialiser makes the argument unnecessary.
     */
    private static void writeProblem(HttpServletResponse response, HttpStatus status, String detail, String instance)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        PROBLEM_MAPPER.writeValue(response.getWriter(), Map.of(
                "type", "about:blank",
                "title", status.getReasonPhrase(),
                "status", status.value(),
                "detail", detail,
                "instance", instance));
    }
}
