package com.ripplechat.backend.admin;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/** One administrative action, for the admin panel's audit trail. */
@Entity
@Table(name = "audit_log", indexes = {
        @Index(name = "idx_audit_log_created", columnList = "created_at DESC")
})
@Getter
@Setter
@NoArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Username of the admin who performed the action. */
    @Column(nullable = false)
    private String actor;

    /** Machine-readable action key, e.g. {@code admin_granted}, {@code user_disabled}. */
    @Column(nullable = false, length = 64)
    private String action;

    /** Username the action was applied to, or null for non-user-scoped actions. */
    @Column
    private String target;

    /** Optional human-readable context. */
    @Column(columnDefinition = "text")
    private String details;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public AuditLog(String actor, String action, String target, String details) {
        this.actor = actor;
        this.action = action;
        this.target = target;
        this.details = details;
    }
}
