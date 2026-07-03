-- Global admin flag and a moderation "disabled" (ban) flag on users.
ALTER TABLE users ADD COLUMN admin    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN disabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Persisted audit trail of administrative actions, for the admin panel's log view.
CREATE TABLE audit_log (
    id         UUID PRIMARY KEY,
    actor      VARCHAR(255) NOT NULL,   -- username of the admin who acted
    action     VARCHAR(64)  NOT NULL,   -- e.g. admin_granted, user_disabled
    target     VARCHAR(255),            -- username the action was applied to (nullable)
    details    TEXT,                    -- optional human-readable context
    created_at TIMESTAMPTZ  NOT NULL
);

-- Newest-first log listing.
CREATE INDEX idx_audit_log_created ON audit_log (created_at DESC);
