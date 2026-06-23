-- Adds two-factor authentication (TOTP) columns to the users table:
--   totp_secret           — the per-user shared TOTP secret (null until 2FA setup begins)
--   is_two_factor_enabled — whether TOTP is currently active for the account
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
