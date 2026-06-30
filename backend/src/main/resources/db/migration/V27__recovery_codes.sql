-- 2FA recovery (backup) codes: single-use codes that substitute for a TOTP code
-- when the authenticator is unavailable. Only the SHA-256 hash of the normalised
-- code is stored, so a database leak does not expose usable codes.
create table recovery_codes (
    id         uuid not null,
    user_id    uuid not null,
    code_hash  varchar(255) not null,
    used       boolean not null default false,
    created_at timestamp(6) with time zone not null,
    constraint pk_recovery_codes primary key (id),
    constraint fk_recovery_code_user foreign key (user_id) references users (id)
);
create index idx_recovery_code_user on recovery_codes (user_id);
