-- Adds public_key column to the users table to store the JWK representation of user ECDH public keys.
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_key TEXT;
