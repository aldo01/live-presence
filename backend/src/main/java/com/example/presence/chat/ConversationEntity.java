package com.example.presence.chat;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "conversations", indexes = {
    @Index(name = "idx_conversations_user1", columnList = "user1_id,last_message_at"),
    @Index(name = "idx_conversations_user2", columnList = "user2_id,last_message_at")
})
public class ConversationEntity {

  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "user1_id", nullable = false, columnDefinition = "uuid")
  private UUID user1Id;

  @Column(name = "user2_id", nullable = false, columnDefinition = "uuid")
  private UUID user2Id;

  @Column(name = "last_message_at")
  private Instant lastMessageAt;

  @Column(name = "last_message_preview", columnDefinition = "text")
  private String lastMessagePreview;

  @Column(name = "user1_unread", nullable = false)
  private Integer user1Unread = 0;

  @Column(name = "user2_unread", nullable = false)
  private Integer user2Unread = 0;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public UUID getId() { return id; }
  public UUID getUser1Id() { return user1Id; }
  public UUID getUser2Id() { return user2Id; }
  public Instant getLastMessageAt() { return lastMessageAt; }
  public String getLastMessagePreview() { return lastMessagePreview; }
  public Integer getUser1Unread() { return user1Unread; }
  public Integer getUser2Unread() { return user2Unread; }
  public Instant getCreatedAt() { return createdAt; }

  public void setId(UUID id) { this.id = id; }
  public void setUser1Id(UUID user1Id) { this.user1Id = user1Id; }
  public void setUser2Id(UUID user2Id) { this.user2Id = user2Id; }
  public void setLastMessageAt(Instant lastMessageAt) { this.lastMessageAt = lastMessageAt; }
  public void setLastMessagePreview(String preview) { this.lastMessagePreview = preview; }
  public void setUser1Unread(Integer count) { this.user1Unread = count; }
  public void setUser2Unread(Integer count) { this.user2Unread = count; }
}
