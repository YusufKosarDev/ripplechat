package com.ripplechat.backend.admin.dto;

import com.ripplechat.backend.admin.AuditLog;

import java.time.Instant;
import java.util.UUID;

/** One audit-trail row, for the admin panel's log view. */
public record AuditLogEntry(
        UUID id,
        String actor,
        String action,
        String target,
        String details,
        Instant createdAt
) {
    public static AuditLogEntry from(AuditLog log) {
        return new AuditLogEntry(
                log.getId(),
                log.getActor(),
                log.getAction(),
                log.getTarget(),
                log.getDetails(),
                log.getCreatedAt()
        );
    }
}
