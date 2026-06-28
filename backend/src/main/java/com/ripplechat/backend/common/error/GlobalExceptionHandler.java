package com.ripplechat.backend.common.error;

import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.DuplicateResourceException;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.InvalidCredentialsException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.net.URI;
import java.time.Instant;
import java.util.List;

/**
 * Turns exceptions into RFC 7807 {@link ProblemDetail} responses
 * (media type {@code application/problem+json}): {@code title}, {@code status},
 * {@code detail} and {@code instance}, plus a {@code timestamp} and — for
 * validation failures — a {@code fieldErrors} extension.
 *
 * <p>Extends {@link ResponseEntityExceptionHandler} so the Spring MVC framework
 * exceptions (unreadable body, validation, 404/405, rate-limit {@code ResponseStatusException}, …)
 * are handled <em>here</em> rather than by Spring Boot's built-in problem-detail
 * handler. Boot only registers its own when no {@code ResponseEntityExceptionHandler}
 * bean is present, so providing this one keeps a single, consistent error shape —
 * notably the {@code fieldErrors} on validation and the {@code Retry-After} on 429.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // Back-off hint (seconds) sent with rate-limit (429) responses.
    private static final int RETRY_AFTER_SECONDS = 5;

    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
        return problem(HttpStatus.NOT_FOUND, ex.getMessage(), request, null);
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ProblemDetail handleDuplicate(DuplicateResourceException ex, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, ex.getMessage(), request, null);
    }

    @ExceptionHandler(ForbiddenException.class)
    public ProblemDetail handleForbidden(ForbiddenException ex, HttpServletRequest request) {
        return problem(HttpStatus.FORBIDDEN, ex.getMessage(), request, null);
    }

    @ExceptionHandler(BadRequestException.class)
    public ProblemDetail handleBadRequest(BadRequestException ex, HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, ex.getMessage(), request, null);
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ProblemDetail handleInvalidCredentials(InvalidCredentialsException ex, HttpServletRequest request) {
        return problem(HttpStatus.UNAUTHORIZED, ex.getMessage(), request, null);
    }

    /**
     * Bean-validation failures on a request body: attaches the per-field errors as
     * a {@code fieldErrors} extension on top of the standard problem detail.
     */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
                                                                  HttpHeaders headers,
                                                                  HttpStatusCode status,
                                                                  WebRequest request) {
        List<FieldValidationError> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(this::toFieldError)
                .toList();
        ProblemDetail body = problem(HttpStatus.BAD_REQUEST, "Validation failed",
                servletRequest(request), fieldErrors);
        return handleExceptionInternal(ex, body, headers, HttpStatus.BAD_REQUEST, request);
    }

    /**
     * Single funnel for every framework exception ({@link ResponseEntityExceptionHandler}
     * routes them all through here): stamps {@code instance} + {@code timestamp} so they
     * match the domain-exception responses, and adds {@code Retry-After} on a 429.
     */
    @Override
    protected ResponseEntity<Object> createResponseEntity(Object body, HttpHeaders headers,
                                                          HttpStatusCode statusCode, WebRequest request) {
        if (body instanceof ProblemDetail problem) {
            HttpServletRequest servlet = servletRequest(request);
            if (problem.getInstance() == null && servlet != null) {
                problem.setInstance(URI.create(servlet.getRequestURI()));
            }
            if (problem.getProperties() == null || !problem.getProperties().containsKey("timestamp")) {
                problem.setProperty("timestamp", Instant.now());
            }
            HttpStatus resolved = HttpStatus.resolve(statusCode.value());
            if (problem.getTitle() == null && resolved != null) {
                problem.setTitle(resolved.getReasonPhrase());
            }
        }
        if (statusCode.value() == HttpStatus.TOO_MANY_REQUESTS.value()) {
            HttpHeaders mutable = new HttpHeaders();
            mutable.addAll(headers);
            mutable.set(HttpHeaders.RETRY_AFTER, String.valueOf(RETRY_AFTER_SECONDS));
            headers = mutable;
        }
        return super.createResponseEntity(body, headers, statusCode, request);
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex, HttpServletRequest request) {
        // Log the cause (the response body stays generic to avoid leaking internals).
        log.error("Unexpected error handling {} {}", request.getMethod(), request.getRequestURI(), ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred", request, null);
    }

    private FieldValidationError toFieldError(FieldError error) {
        return new FieldValidationError(error.getField(), error.getDefaultMessage());
    }

    private static HttpServletRequest servletRequest(WebRequest request) {
        return request instanceof ServletWebRequest swr ? swr.getRequest() : null;
    }

    private ProblemDetail problem(HttpStatus status, String detail, HttpServletRequest request,
                                  List<FieldValidationError> fieldErrors) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(
                status, detail == null ? status.getReasonPhrase() : detail);
        body.setTitle(status.getReasonPhrase());
        if (request != null) {
            body.setInstance(URI.create(request.getRequestURI()));
        }
        body.setProperty("timestamp", Instant.now());
        if (fieldErrors != null && !fieldErrors.isEmpty()) {
            body.setProperty("fieldErrors", fieldErrors);
        }
        return body;
    }
}
