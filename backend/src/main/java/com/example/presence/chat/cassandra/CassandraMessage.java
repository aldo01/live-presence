package com.example.presence.chat.cassandra;

import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;
import org.springframework.data.cassandra.core.mapping.Column;

import java.time.Instant;
import java.util.UUID;

@Table("messages_by_conversation")
public class CassandraMessage {

  @PrimaryKey
  private CassandraMessageKey key;

  @Column("sender_id")
  private UUID senderId;

  @Column("content")
  private String content;

  @Column("message_type")
  private String messageType;

  @Column("media_url")
  private String mediaUrl;

  // Constructors
  public CassandraMessage() {}

  public CassandraMessage(UUID conversationId, Instant createdAt, UUID messageId, 
                          UUID senderId, String content, String messageType, String mediaUrl) {
    this.key = new CassandraMessageKey(conversationId, createdAt, messageId);
    this.senderId = senderId;
    this.content = content;
    this.messageType = messageType;
    this.mediaUrl = mediaUrl;
  }

  // Getters and Setters
  public CassandraMessageKey getKey() {
    return key;
  }

  public void setKey(CassandraMessageKey key) {
    this.key = key;
  }

  public UUID getSenderId() {
    return senderId;
  }

  public void setSenderId(UUID senderId) {
    this.senderId = senderId;
  }

  public String getContent() {
    return content;
  }

  public void setContent(String content) {
    this.content = content;
  }

  public String getMessageType() {
    return messageType;
  }

  public void setMessageType(String messageType) {
    this.messageType = messageType;
  }

  public String getMediaUrl() {
    return mediaUrl;
  }

  public void setMediaUrl(String mediaUrl) {
    this.mediaUrl = mediaUrl;
  }
}
