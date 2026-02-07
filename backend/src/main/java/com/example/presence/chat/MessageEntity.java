package com.example.presence.chat;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "messages", indexes = {
    @Index(name = "idx_messages_conversation_created", columnList = "conversation_id,created_at"),
    @Index(name = "idx_messages_sender", columnList = "sender_id")
})
public class MessageEntity {

  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "conversation_id", nullable = false, columnDefinition = "uuid")
  private UUID conversationId;

  @Column(name = "sender_id", nullable = false, columnDefinition = "uuid")
  private UUID senderId;

  @Column(nullable = false, columnDefinition = "text")
  private String content;

  @Column(name = "is_read", nullable = false)
  private boolean isRead = false;

  @Column(name = "read_at")
  private Instant readAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }
  public UUID getConversationId() { return conversationId; }
  public UUID getSenderId() { return senderId; }
  public String getContent() { return content; }
  public boolean isRead() { return isRead; }
  public Instant getReadAt() { return readAt; }
  public Instant getCreatedAt() { return createdAt; }

  public void setConversationId(UUID conversationId) { this.conversationId = conversationId; }
  public void setSenderId(UUID senderId) { this.senderId = senderId; }
  public void setContent(String content) { this.content = content; }
  public void setRead(boolean read) { this.isRead = read; }
  public void setReadAt(Instant readAt) { this.readAt = readAt; }
}
