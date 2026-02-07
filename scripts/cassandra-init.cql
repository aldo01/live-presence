-- Create keyspace for live-presence chat
CREATE KEYSPACE IF NOT EXISTS live_presence
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 1
};

USE live_presence;

-- Messages table partitioned by conversation_id
-- Clustering by created_at (DESC) for latest messages first
CREATE TABLE IF NOT EXISTS messages_by_conversation (
    conversation_id UUID,
    created_at TIMESTAMP,
    message_id UUID,
    sender_id UUID,
    content TEXT,
    message_type TEXT,
    media_url TEXT,
    PRIMARY KEY (conversation_id, created_at, message_id)
) WITH CLUSTERING ORDER BY (created_at DESC)
  AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_size': 1,
    'compaction_window_unit': 'DAYS'
  }
  AND gc_grace_seconds = 86400
  AND default_time_to_live = 7776000;  -- 90 days retention

-- Secondary index for searching messages by sender
CREATE INDEX IF NOT EXISTS idx_messages_sender 
ON messages_by_conversation (sender_id);

-- Messages by user (for searching across all conversations)
CREATE TABLE IF NOT EXISTS messages_by_user (
    user_id UUID,
    created_at TIMESTAMP,
    message_id UUID,
    conversation_id UUID,
    content TEXT,
    message_type TEXT,
    PRIMARY KEY (user_id, created_at, message_id)
) WITH CLUSTERING ORDER BY (created_at DESC)
  AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_size': 7,
    'compaction_window_unit': 'DAYS'
  };

-- Conversation metadata (lightweight, frequently accessed)
CREATE TABLE IF NOT EXISTS conversation_metadata (
    conversation_id UUID PRIMARY KEY,
    user1_id UUID,
    user2_id UUID,
    last_message_at TIMESTAMP,
    last_message_content TEXT,
    unread_count_user1 INT,
    unread_count_user2 INT
);

-- Create materialized view for recent conversations
CREATE MATERIALIZED VIEW IF NOT EXISTS conversations_by_user AS
    SELECT conversation_id, user1_id, user2_id, last_message_at, last_message_content
    FROM conversation_metadata
    WHERE user1_id IS NOT NULL 
      AND conversation_id IS NOT NULL 
      AND last_message_at IS NOT NULL
    PRIMARY KEY (user1_id, last_message_at, conversation_id)
    WITH CLUSTERING ORDER BY (last_message_at DESC);
