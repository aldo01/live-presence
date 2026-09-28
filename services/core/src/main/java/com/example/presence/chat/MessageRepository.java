package com.example.presence.chat;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<MessageEntity, UUID> {
  
  // Load last 50 messages (for initial load - WhatsApp style)
  List<MessageEntity> findTop50ByConversationIdOrderByCreatedAtDesc(UUID conversationId);

  // Paginated messages for infinite scroll
  Page<MessageEntity> findByConversationIdOrderByCreatedAtDesc(UUID conversationId, Pageable pageable);

  // Get messages before a specific timestamp (for loading older messages)
  @Query("SELECT m FROM MessageEntity m WHERE m.conversationId = :conversationId AND m.createdAt < :before ORDER BY m.createdAt DESC")
  List<MessageEntity> findMessagesBeforeTimestamp(@Param("conversationId") UUID conversationId, 
                                                   @Param("before") java.time.Instant before,
                                                   Pageable pageable);

  // Mark all messages as read
  @Modifying
  @Query("UPDATE MessageEntity m SET m.isRead = true, m.readAt = CURRENT_TIMESTAMP WHERE m.conversationId = :conversationId AND m.senderId != :userId AND m.isRead = false")
  int markMessagesAsRead(@Param("conversationId") UUID conversationId, @Param("userId") UUID userId);

  // Count unread messages in a conversation for a user
  @Query("SELECT COUNT(m) FROM MessageEntity m WHERE m.conversationId = :conversationId AND m.senderId != :userId AND m.isRead = false")
  long countUnreadMessages(@Param("conversationId") String conversationId, @Param("userId") String userId);
}
