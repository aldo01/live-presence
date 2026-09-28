package com.example.presence.notifications;

import com.example.presence.user.UserEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Publishes notification-create requests to the notification-service over the
 * {@code notif.create} Redis channel. Core no longer persists notifications or
 * pushes them directly; it only emits domain events. Method signatures are kept
 * identical to the previous in-process service so producers (feed/chat) are
 * unchanged.
 */
@Service
public class NotificationService {

  private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
  public static final String CREATE_CHANNEL = "notif.create";

  private final StringRedisTemplate redis;
  private final ObjectMapper mapper;

  public NotificationService(StringRedisTemplate redis, ObjectMapper mapper) {
    this.redis = redis;
    this.mapper = mapper;
  }

  private static String previewOf(String s) {
    if (s == null) return null;
    String t = s.trim();
    if (t.isEmpty()) return "";
    return t.length() > 120 ? t.substring(0, 120) + "..." : t;
  }

  public void notifyPostLiked(UUID recipientId, UserEntity actor, UUID postId, String postContent) {
    publish(recipientId, actor, "POST_LIKED", postId, null, null, previewOf(postContent));
  }

  public void notifyPostCommented(UUID recipientId, UserEntity actor, UUID postId, UUID commentId, String commentContent) {
    publish(recipientId, actor, "POST_COMMENTED", postId, commentId, null, previewOf(commentContent));
  }

  public void notifyPostReacted(UUID recipientId, UserEntity actor, UUID postId, String reactionType) {
    publish(recipientId, actor, "POST_REACTED", postId, null, null, reactionType != null ? reactionType : "");
  }

  public void notifyMessageReceived(UUID recipientId, UserEntity actor, UUID conversationId, String preview) {
    publish(recipientId, actor, "MESSAGE_RECEIVED", null, null, conversationId, previewOf(preview));
  }

  private void publish(
      UUID recipientId,
      UserEntity actor,
      String type,
      UUID postId,
      UUID commentId,
      UUID conversationId,
      String preview
  ) {
    if (recipientId == null || actor == null || actor.getId() == null) return;
    if (recipientId.equals(actor.getId())) return;

    Map<String, Object> req = new HashMap<>();
    req.put("recipientId", recipientId.toString());
    req.put("type", type);
    req.put("actorId", actor.getId().toString());
    req.put("actorDisplayName", actor.getDisplayName());
    req.put("actorAvatarUrl", actor.getAvatarUrl());
    req.put("postId", postId != null ? postId.toString() : null);
    req.put("commentId", commentId != null ? commentId.toString() : null);
    req.put("conversationId", conversationId != null ? conversationId.toString() : null);
    req.put("preview", preview);

    try {
      redis.convertAndSend(CREATE_CHANNEL, mapper.writeValueAsString(req));
    } catch (Exception e) {
      log.error("Failed to publish notif.create for recipient {}: {}", recipientId, e.getMessage());
    }
  }
}
