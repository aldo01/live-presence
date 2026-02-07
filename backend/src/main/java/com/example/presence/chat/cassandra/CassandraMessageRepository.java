package com.example.presence.chat.cassandra;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface CassandraMessageRepository extends CassandraRepository<CassandraMessage, CassandraMessageKey> {

  /**
   * Get last N messages for a conversation (most recent first)
   * This is highly optimized in Cassandra - single partition read
   */
  @Query("SELECT * FROM messages_by_conversation WHERE conversation_id = ?0 LIMIT ?1")
  List<CassandraMessage> findTopNByConversationId(UUID conversationId, int limit);

  /**
   * Get messages in a time range
   * Useful for pagination and loading older messages
   */
  @Query("SELECT * FROM messages_by_conversation WHERE conversation_id = ?0 AND created_at < ?1 LIMIT ?2")
  List<CassandraMessage> findByConversationIdAndCreatedAtBefore(UUID conversationId, Instant before, int limit);

  /**
   * Count messages (use with caution - can be expensive)
   */
  @Query("SELECT COUNT(*) FROM messages_by_conversation WHERE conversation_id = ?0")
  long countByConversationId(UUID conversationId);
}
