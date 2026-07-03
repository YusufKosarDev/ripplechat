package com.ripplechat.backend.admin;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Persists administrative actions to the audit trail. */
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    @Transactional
    public void record(String actor, String action, String target, String details) {
        auditLogRepository.save(new AuditLog(actor, action, target, details));
    }
}
