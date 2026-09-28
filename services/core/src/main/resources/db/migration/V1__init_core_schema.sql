-- Core service schema.
--
-- Baseline created when the monolith was split. It consolidates the old
-- V1-V6 migrations from the monolith and reconciles two names that had
-- drifted between JPA entities, the migration file, and the native SQL
-- queries: the profile table (now `users`, matching every entity's
-- @Table("users")) and the follow table (now `user_follows(follower_id,
-- following_id)`, matching UserFollowEntity + the feed's follow join).

-- ---------------------------------------------------------------- users
-- id is assigned by the auth service, never generated here.
-- password_hash is nullable because the auth service is the source of
-- truth for credentials; this column exists only for the legacy backfill
-- migration in V2 and can be dropped once every deployment is migrated.
CREATE TABLE IF NOT EXISTS users (
  id                   uuid PRIMARY KEY,
  email                varchar(320),
  password_hash        varchar(255),
  display_name         varchar(100) NOT NULL,
  interest             varchar(120) NOT NULL DEFAULT 'General',
  live                 boolean NOT NULL DEFAULT false,
  avatar_url           varchar(500),
  bio                  varchar(500),
  gender               varchar(20),
  profile_public       boolean NOT NULL DEFAULT true,
  last_location_lat    double precision,
  last_location_lon    double precision,
  followers_count      integer NOT NULL DEFAULT 0,
  following_count      integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_live_location
  ON users (last_location_lat, last_location_lon) WHERE live = true;
CREATE INDEX IF NOT EXISTS idx_users_public ON users (profile_public);

-- ----------------------------------------------------------------------- posts

CREATE TABLE IF NOT EXISTS posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         text NOT NULL,
  interest        varchar(50),
  location_lat    double precision NOT NULL,
  location_lon    double precision NOT NULL,
  image_url       varchar(500),
  likes_count     integer NOT NULL DEFAULT 0,
  comments_count  integer NOT NULL DEFAULT 0,
  reactions_count integer NOT NULL DEFAULT 0,
  views_count     bigint  NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_location ON posts (location_lat, location_lon);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_interest
  ON posts (interest, created_at DESC) WHERE interest IS NOT NULL;

-- ------------------------------------------------------------ likes / comments

CREATE TABLE IF NOT EXISTS post_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes (user_id);

CREATE TABLE IF NOT EXISTS post_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_user ON post_comments (user_id);

-- ------------------------------------------------------------------- reactions

CREATE TABLE IF NOT EXISTS reactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type varchar(20) NOT NULL
                CHECK (reaction_type IN ('LIKE','LOVE','HAHA','WOW','SAD','ANGRY')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions (user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_type ON reactions (reaction_type);

CREATE OR REPLACE FUNCTION update_post_reactions_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET reactions_count = reactions_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET reactions_count = GREATEST(0, reactions_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reactions_count ON reactions;
CREATE TRIGGER trigger_update_reactions_count
AFTER INSERT OR DELETE ON reactions
FOR EACH ROW EXECUTE FUNCTION update_post_reactions_count();

-- ------------------------------------------------------------ conversations

CREATE TABLE IF NOT EXISTS conversations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at      timestamptz,
  last_message_preview text,
  user1_unread         integer NOT NULL DEFAULT 0,
  user2_unread         integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT conversations_user_not_same CHECK (user1_id <> user2_id),
  -- Canonical ordering makes a 1:1 conversation unique regardless of who starts it.
  CONSTRAINT conversations_user_order CHECK (user1_id < user2_id),
  UNIQUE (user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user1
  ON conversations (user1_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversations_user2
  ON conversations (user2_id, last_message_at DESC NULLS LAST);

-- Durable copy of chat. Cassandra, when enabled, is the scale-out read path;
-- this table stays authoritative so the platform runs without it.
CREATE TABLE IF NOT EXISTS messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         text NOT NULL,
  is_read         boolean NOT NULL DEFAULT false,
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages (conversation_id) WHERE is_read = false;

-- ---------------------------------------------------------------- social graph

CREATE TABLE IF NOT EXISTS user_follows (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CONSTRAINT user_follows_not_self CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows (following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows (follower_id);

CREATE OR REPLACE FUNCTION update_user_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
    UPDATE users SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_follow_counts ON user_follows;
CREATE TRIGGER trigger_update_follow_counts
AFTER INSERT OR DELETE ON user_follows
FOR EACH ROW EXECUTE FUNCTION update_user_follow_counts();

-- --------------------------------------------------------------- notifications

CREATE TABLE IF NOT EXISTS notifications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id           uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_display_name varchar(100),
  actor_avatar_url   varchar(500),
  type               varchar(40) NOT NULL,
  post_id            uuid REFERENCES posts(id) ON DELETE CASCADE,
  comment_id         uuid REFERENCES post_comments(id) ON DELETE CASCADE,
  conversation_id    uuid REFERENCES conversations(id) ON DELETE CASCADE,
  preview            text,
  is_read            boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  read_at            timestamptz
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications (recipient_id) WHERE is_read = false;
