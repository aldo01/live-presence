package com.example.presence.chat.cassandra;

import org.springframework.data.cassandra.core.cql.Ordering;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyClass;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@PrimaryKeyClass
public class CassandraMessageKey implements Serializable {

  @PrimaryKeyColumn(name = "conversation_id", ordinal = 0, type = PrimaryKeyType.PARTITIONED)
  private UUID conversationId;

  @PrimaryKeyColumn(name = "created_at", ordinal = 1, type = PrimaryKeyType.CLUSTERED, ordering = Ordering.DESCENDING)
  private Instant createdAt;

  @PrimaryKeyColumn(name = "message_id", ordinal = 2, type = PrimaryKeyType.CLUSTERED)
  private UUID messageId;

  // Constructors
  public CassandraMessageKey() {}

  public CassandraMessageKey(UUID conversationId, Instant createdAt, UUID messageId) {
    this.conversationId = conversationId;
    this.createdAt = createdAt;
    this.messageId = messageId;
  }

  // Getters and Setters
  public UUID getConversationId() {
    return conversationId;
  }

  public void setConversationId(UUID conversationId) {
    this.conversationId = conversationId;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }

  public UUID getMessageId() {
    return messageId;
  }

  public void setMessageId(UUID messageId) {
    this.messageId = messageId;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    CassandraMessageKey that = (CassandraMessageKey) o;
    return Objects.equals(conversationId, that.conversationId) &&
           Objects.equals(createdAt, that.createdAt) &&
           Objects.equals(messageId, that.messageId);
  }

  @Override
  public int hashCode() {
    return Objects.hash(conversationId, createdAt, messageId);
  }
}
