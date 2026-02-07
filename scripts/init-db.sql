-- Initialize database schemas

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

-- Print initialization message
DO $$
BEGIN
  RAISE NOTICE 'Live Presence database initialized successfully!';
END $$;
