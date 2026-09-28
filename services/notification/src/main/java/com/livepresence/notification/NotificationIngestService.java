package com.livepresence.notification;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Consumes notification-create requests, persists them, and republishes an
 * enriched delivery event on {@code notif.deliver}. Core subscribes to that
 * channel and pushes the event to the recipient's live WebSocket session
 * (core owns the in-memory STOMP broker where clients are connected).
 */
@Service
public class NotificationIngestService {

  private static final Logger log = LoggerFactory.getLogger(NotificationIngestService.class);
  public static final String DELIVER_CHANNEL = "notif.deliver";

  private final NotificationRepository repo;
  private final StringRedisTemplate redis;
  private final ObjectMapper mapper;

  public NotificationIngestService(NotificationRepository repo, StringRedisTemplate redis, ObjectMapper mapper) {
    this.repo = repo;
    this.redis = redis;
    this.mapper = mapper;
  }

  @Transactional
  public void ingest(NotificationCreateRequest req) {
    if (req.recipientId() == null || req.actorId() == null) return;
    // Never notify yourself.
    if (req.recipientId().equals(req.actorId())) return;

    NotificationEntity n = new NotificationEntity();
    n.setId(UUID.randomUUID());
    n.setRecipientId(UUID.fromString(req.recipientId()));
    n.setActorId(UUID.fromString(req.actorId()));
    n.setActorDisplayName(req.actorDisplayName());
    n.setActorAvatarUrl(req.actorAvatarUrl());
    n.setType(NotificationEntity.Type.valueOf(req.type()));
    n.setPostId(parseUuid(req.postId()));
    n.setCommentId(parseUuid(req.commentId()));
    n.setConversationId(parseUuid(req.conversationId()));
    n.setPreview(req.preview());
    n.setRead(false);
    n.setCreatedAt(Instant.now());

    NotificationEntity saved = repo.save(n);
    publishDelivery(saved);
  }

  private void publishDelivery(NotificationEntity n) {
    Map<String, Object> event = new HashMap<>();
    event.put("recipientId", n.getRecipientId().toString());
    event.put("id", n.getId().toString());
    event.put("type", n.getType().name());
    event.put("actorId", n.getActorId() != null ? n.getActorId().toString() : null);
    event.put("actorDisplayName", n.getActorDisplayName());
    event.put("actorAvatarUrl", n.getActorAvatarUrl());
    event.put("postId", n.getPostId() != null ? n.getPostId().toString() : null);
    event.put("commentId", n.getCommentId() != null ? n.getCommentId().toString() : null);
    event.put("conversationId", n.getConversationId() != null ? n.getConversationId().toString() : null);
    event.put("preview", n.getPreview());
    event.put("createdAt", n.getCreatedAt().toString());

    try {
      redis.convertAndSend(DELIVER_CHANNEL, mapper.writeValueAsString(event));
    } catch (Exception e) {
      log.error("Failed to publish delivery event for notification {}: {}", n.getId(), e.getMessage());
    }
  }

  private static UUID parseUuid(String s) {
    if (s == null || s.isBlank()) return null;
    try {
      return UUID.fromString(s);
    } catch (IllegalArgumentException e) {
      return null;
    }
  }
}
