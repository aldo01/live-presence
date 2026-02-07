package com.example.presence.chat;

import com.example.presence.chat.cassandra.CassandraMessage;
import com.example.presence.chat.cassandra.CassandraMessageRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MessageStorageService {

  private final CassandraMessageRepository cassandraRepo;
  private final RedisTemplate<String, String> redisTemplate;
  private final ObjectMapper objectMapper;

  private static final String REDIS_MESSAGE_CACHE_PREFIX = "chat:messages:";
  private static final int CACHE_SIZE = 50; // Last 50 messages cached
  private static final Duration CACHE_TTL = Duration.ofHours(24);

  public MessageStorageService(
      CassandraMessageRepository cassandraRepo,
      RedisTemplate<String, String> redisTemplate,
      ObjectMapper objectMapper
  ) {
    this.cassandraRepo = cassandraRepo;
    this.redisTemplate = redisTemplate;
    this.objectMapper = objectMapper;
  }

  /**
   * Save message to Cassandra and update Redis cache
   * WhatsApp-style: Write to Cassandra async, cache immediately
   */
  public void saveMessage(UUID conversationId, UUID messageId, UUID senderId, 
                          String content, String messageType, String mediaUrl) {
    Instant now = Instant.now();
    
    CassandraMessage msg = new CassandraMessage(
        conversationId, now, messageId, senderId, content, messageType, mediaUrl
    );

    // Save to Cassandra asynchronously
    new Thread(() -> {
      try {
        cassandraRepo.save(msg);
      } catch (Exception e) {
        System.err.println("Failed to save message to Cassandra: " + e.getMessage());
      }
    }).start();

    // Update Redis cache immediately - WhatsApp style
    updateCacheWithNewMessage(conversationId, msg);
  }

  /**
   * Get recent messages - Redis first, then Cassandra
   * This is the WhatsApp pattern: cache-first for speed
   */
  public List<MessageDTO> getRecentMessages(UUID conversationId, int limit) {
    // Try cache first
    List<MessageDTO> cached = getFromCache(conversationId);
    if (cached != null && !cached.isEmpty()) {
      return cached.stream().limit(limit).collect(Collectors.toList());
    }

    // Cache miss - load from Cassandra
    List<CassandraMessage> messages = cassandraRepo.findTopNByConversationId(conversationId, limit);
    List<MessageDTO> dtos = messages.stream()
        .map(this::toDTO)
        .collect(Collectors.toList());

    // Populate cache for next time
    if (!dtos.isEmpty()) {
      cacheMessages(conversationId, dtos);
    }

    return dtos;
  }

  /**
   * Get older messages (pagination) - always from Cassandra
   */
  public List<MessageDTO> getMessagesBefore(UUID conversationId, Instant before, int limit) {
    List<CassandraMessage> messages = cassandraRepo.findByConversationIdAndCreatedAtBefore(
        conversationId, before, limit
    );
    return messages.stream()
        .map(this::toDTO)
        .collect(Collectors.toList());
  }

  private void updateCacheWithNewMessage(UUID conversationId, CassandraMessage msg) {
    String cacheKey = REDIS_MESSAGE_CACHE_PREFIX + conversationId;
    
    try {
      // Get current cache
      List<MessageDTO> cached = getFromCache(conversationId);
      if (cached == null) {
        cached = new ArrayList<>();
      }

      // Add new message at the beginning (most recent first)
      cached.add(0, toDTO(msg));

      // Keep only last 50 messages
      if (cached.size() > CACHE_SIZE) {
        cached = cached.subList(0, CACHE_SIZE);
      }

      // Save back to cache
      cacheMessages(conversationId, cached);
    } catch (Exception e) {
      System.err.println("Failed to update Redis cache: " + e.getMessage());
    }
  }

  private void cacheMessages(UUID conversationId, List<MessageDTO> messages) {
    String cacheKey = REDIS_MESSAGE_CACHE_PREFIX + conversationId;
    try {
      String json = objectMapper.writeValueAsString(messages);
      redisTemplate.opsForValue().set(cacheKey, json, CACHE_TTL);
    } catch (JsonProcessingException e) {
      System.err.println("Failed to serialize messages for cache: " + e.getMessage());
    }
  }

  private List<MessageDTO> getFromCache(UUID conversationId) {
    String cacheKey = REDIS_MESSAGE_CACHE_PREFIX + conversationId;
    String json = redisTemplate.opsForValue().get(cacheKey);
    
    if (json == null) return null;

    try {
      return objectMapper.readValue(json, 
          objectMapper.getTypeFactory().constructCollectionType(List.class, MessageDTO.class)
      );
    } catch (JsonProcessingException e) {
      System.err.println("Failed to deserialize cached messages: " + e.getMessage());
      return null;
    }
  }

  private MessageDTO toDTO(CassandraMessage msg) {
    return new MessageDTO(
        msg.getKey().getMessageId().toString(),
        msg.getSenderId().toString(),
        msg.getContent(),
        msg.getMessageType(),
        msg.getMediaUrl(),
        msg.getKey().getCreatedAt().toString()
    );
  }

  public record MessageDTO(
      String messageId,
      String senderId,
      String content,
      String messageType,
      String mediaUrl,
      String createdAt
  ) {}
}
