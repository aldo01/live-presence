-- Add profile_public column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_public BOOLEAN NOT NULL DEFAULT true;

-- Create index for faster profile queries
CREATE INDEX IF NOT EXISTS idx_users_profile_public ON users(profile_public);
