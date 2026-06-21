package com.ripplechat.backend.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Tags every request with a correlation id, exposed in two ways:
 * <ul>
 *   <li>in the SLF4J {@link MDC} as {@code requestId}, so every log line emitted
 *       while handling the request carries it (see {@code logging.pattern.level});</li>
 *   <li>echoed back on the {@code X-Request-Id} response header, so a client (or a
 *       proxy) can correlate a response with the server logs.</li>
 * </ul>
 * An inbound {@code X-Request-Id} is honoured when present so the id can span a
 * proxy hop; otherwise a fresh one is generated.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    private static final String MDC_KEY = "requestId";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String requestId = request.getHeader(REQUEST_ID_HEADER);
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString();
        } else if (requestId.length() > 64) {
            // Don't let a client inject an unbounded value into logs/headers.
            requestId = requestId.substring(0, 64);
        }
        MDC.put(MDC_KEY, requestId);
        response.setHeader(REQUEST_ID_HEADER, requestId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}
