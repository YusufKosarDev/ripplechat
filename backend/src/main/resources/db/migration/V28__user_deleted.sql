-- GDPR account erasure marker. The row is retained (so a deleted user's messages
-- stay attributable to an anonymised identity and referencing channels/memberships
-- don't break) but personal data is scrubbed and the account can no longer sign in.
alter table users add column if not exists deleted boolean not null default false;
alter table users add column if not exists deleted_at timestamp(6) with time zone;
