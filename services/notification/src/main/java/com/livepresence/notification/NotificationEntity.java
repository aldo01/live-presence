package com.livepresence.notification;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

@Entity
@Table(name = "notifications", indexes = {
    @Index(name = "idx_notifications_recipient_created", columnList = "recipient_id,created_at")
})
public class NotificationEntity {

  public enum Type {
    POST_LIKED,
    POST_REACTED,
    POST_COMMENTED,
    MESSAGE_RECEIVED
  }

  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "recipient_id", nullable = false, columnDefinition = "uuid")
  private UUID recipientId;

  @Column(name = "actor_id", columnDefinition = "uuid")
  private UUID actorId;

  @Column(name = "actor_display_name")
  private String actorDisplayName;

  @Column(name = "actor_avatar_url")
  private String actorAvatarUrl;

  @Enumerated(EnumType.STRING)
  @Column(name = "type", nullable = false, length = 40)
  private Type type;

  @Column(name = "post_id", columnDefinition = "uuid")
  private UUID postId;

  @Column(name = "comment_id", columnDefinition = "uuid")
  private UUID commentId;

  @Column(name = "conversation_id", columnDefinition = "uuid")
  private UUID conversationId;

  @Column(name = "preview", columnDefinition = "text")
  private String preview;

  @Column(name = "is_read", nullable = false)
  private boolean read = false;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "read_at")
  private Instant readAt;

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }
  public UUID getRecipientId() { return recipientId; }
  public void setRecipientId(UUID recipientId) { this.recipientId = recipientId; }
  public UUID getActorId() { return actorId; }
  public void setActorId(UUID actorId) { this.actorId = actorId; }
  public String getActorDisplayName() { return actorDisplayName; }
  public void setActorDisplayName(String actorDisplayName) { this.actorDisplayName = actorDisplayName; }
  public String getActorAvatarUrl() { return actorAvatarUrl; }
  public void setActorAvatarUrl(String actorAvatarUrl) { this.actorAvatarUrl = actorAvatarUrl; }
  public Type getType() { return type; }
  public void setType(Type type) { this.type = type; }
  public UUID getPostId() { return postId; }
  public void setPostId(UUID postId) { this.postId = postId; }
  public UUID getCommentId() { return commentId; }
  public void setCommentId(UUID commentId) { this.commentId = commentId; }
  public UUID getConversationId() { return conversationId; }
  public void setConversationId(UUID conversationId) { this.conversationId = conversationId; }
  public String getPreview() { return preview; }
  public void setPreview(String preview) { this.preview = preview; }
  public boolean isRead() { return read; }
  public void setRead(boolean read) { this.read = read; }
  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
  public Instant getReadAt() { return readAt; }
  public void setReadAt(Instant readAt) { this.readAt = readAt; }
}
