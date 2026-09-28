package com.livepresence.notification;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.livepresence.notification.security.AccessTokenVerifier;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

  private final NotificationRepository repo;
  private final AccessTokenVerifier tokenVerifier;

  public NotificationController(NotificationRepository repo, AccessTokenVerifier tokenVerifier) {
    this.repo = repo;
    this.tokenVerifier = tokenVerifier;
  }

  private String getUserIdFromToken(String authHeader) {
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
      throw new RuntimeException("Invalid authorization header");
    }
    String token = authHeader.substring(7);
    var jws = tokenVerifier.parse(token);
    return jws.getPayload().getSubject();
  }

  @GetMapping
  public ResponseEntity<?> list(
      @RequestHeader("Authorization") String authHeader,
      @RequestParam(defaultValue = "30") int limit
  ) {
    try {
      String userIdStr = getUserIdFromToken(authHeader);
      UUID userId = UUID.fromString(userIdStr);

      int safeLimit = Math.max(1, Math.min(limit, 100));
      var page = repo.findByRecipientIdOrderByCreatedAtDesc(userId, PageRequest.of(0, safeLimit));
      long unreadCount = repo.countByRecipientIdAndReadFalse(userId);

      List<Map<String, Object>> items = page.getContent().stream().map(n -> {
        Map<String, Object> m = new HashMap<>();
        m.put("id", n.getId().toString());
        m.put("type", n.getType().name());
        m.put("actorId", n.getActorId() != null ? n.getActorId().toString() : null);
        m.put("actorDisplayName", n.getActorDisplayName());
        m.put("actorAvatarUrl", n.getActorAvatarUrl());
        m.put("postId", n.getPostId() != null ? n.getPostId().toString() : null);
        m.put("commentId", n.getCommentId() != null ? n.getCommentId().toString() : null);
        m.put("conversationId", n.getConversationId() != null ? n.getConversationId().toString() : null);
        m.put("preview", n.getPreview());
        m.put("isRead", n.isRead());
        m.put("createdAt", n.getCreatedAt() != null ? n.getCreatedAt().toString() : null);
        return m;
      }).toList();

      return ResponseEntity.ok(Map.of(
          "unreadCount", unreadCount,
          "items", items
      ));
    } catch (Exception e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
  }

  @PostMapping("/read")
  public ResponseEntity<?> markAllRead(@RequestHeader("Authorization") String authHeader) {
    try {
      String userIdStr = getUserIdFromToken(authHeader);
      UUID userId = UUID.fromString(userIdStr);
      int updated = repo.markAllRead(userId, Instant.now());
      return ResponseEntity.ok(Map.of("success", true, "updated", updated));
    } catch (Exception e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
  }
}
