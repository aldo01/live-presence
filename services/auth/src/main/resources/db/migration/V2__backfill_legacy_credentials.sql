-- One-time lift of credentials out of the monolith's public.users table.
--
-- On a fresh database this is a no-op. On a database that still carries the
-- pre-split schema it copies id/email/password_hash across, preserving user ids
-- so that every posts.user_id, conversations.user1_id, notifications.recipient_id
-- and so on stays valid.
--
-- Ordering note: the core service's V8 migration drops public.users.password_hash.
-- docker-compose gates core on auth being healthy so this runs first; if you
-- migrate by hand, run auth before core.

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'no legacy public.users table — nothing to backfill';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash'
  ) THEN
    RAISE NOTICE 'legacy public.users has no password_hash — already migrated';
    RETURN;
  END IF;

  INSERT INTO auth.users (id, email, password_hash, display_name, created_at, updated_at)
  SELECT u.id,
         u.email::public.citext,
         u.password_hash,
         COALESCE(NULLIF(btrim(u.display_name), ''), 'User'),
         COALESCE(u.created_at, now()),
         now()
  FROM public.users u
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'backfilled % credential rows into auth.users', (SELECT count(*) FROM auth.users);
END
$$;
