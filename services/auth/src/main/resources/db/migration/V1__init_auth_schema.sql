-- Auth service owns identity and credentials. Nothing else in the platform may
-- write to these tables; other services learn about users from JWT claims and the
-- user.registered event.

CREATE EXTENSION IF NOT EXISTS citext SCHEMA public;

CREATE TABLE IF NOT EXISTS auth.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         public.citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name  varchar(100) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users (email);

-- Refresh tokens are opaque and rotating. Only the SHA-256 hash is stored, so the
-- table is useless to anyone who steals it.
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  replaced_by uuid REFERENCES auth.refresh_tokens(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON auth.refresh_tokens (user_id);

-- Supports the "is this session still live?" lookup without scanning revoked rows.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
  ON auth.refresh_tokens (user_id, expires_at)
  WHERE revoked_at IS NULL;
