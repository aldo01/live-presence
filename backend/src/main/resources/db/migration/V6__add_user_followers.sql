-- Add user followers table for social graph (many-to-many)
CREATE TABLE IF NOT EXISTS user_followers (
    follower_id UUID NOT NULL,
    followed_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followed_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (followed_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT check_not_self_follow CHECK (follower_id != followed_id)
);

-- Index for quick lookup of followers
CREATE INDEX IF NOT EXISTS idx_user_followers_followed ON user_followers(followed_id);
CREATE INDEX IF NOT EXISTS idx_user_followers_follower ON user_followers(follower_id);

-- Add follower/following counts to users table for quick access
ALTER TABLE users ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Trigger to update follower counts
CREATE OR REPLACE FUNCTION update_user_follower_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment followed user's followers_count
        UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.followed_id;
        -- Increment follower user's following_count
        UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement followed user's followers_count
        UPDATE users SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.followed_id;
        -- Decrement follower user's following_count
        UPDATE users SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_follower_counts ON user_followers;
CREATE TRIGGER trigger_update_follower_counts
AFTER INSERT OR DELETE ON user_followers
FOR EACH ROW EXECUTE FUNCTION update_user_follower_counts();
