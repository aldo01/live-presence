-- Add views_count column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS views_count BIGINT NOT NULL DEFAULT 0;

-- Create index for views_count for potential future queries
CREATE INDEX IF NOT EXISTS idx_posts_views_count ON posts(views_count);
