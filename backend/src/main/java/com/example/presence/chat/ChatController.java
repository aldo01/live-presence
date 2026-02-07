package com.example.presence.chat;

import com.example.presence.auth.JwtAuthFilter.JwtPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ChatController {

  private final ConversationRepository convRepo;
  private final MessageStorageService messageStorage;

  public ChatController(ConversationRepository convRepo, MessageStorageService messageStorage) {
    this.convRepo = convRepo;
    this.messageStorage = messageStorage;
  }

  public record CreateConversationRequest(String targetUserId) {}
  public record ConversationResponse(String conversationId) {}

  @PostMapping("/conversations")
  public ResponseEntity<?> createConversation(
      @AuthenticationPrincipal JwtPrincipal p,
      @RequestBody CreateConversationRequest req
  ) {
    if (req.targetUserId() == null || req.targetUserId().isBlank()) {
      return ResponseEntity.badRequest().body("targetUserId required");
    }
    if (req.targetUserId().equals(p.subject())) {
      return ResponseEntity.badRequest().body("cannot chat with self");
    }

    String me = p.subject();
    String other = req.targetUserId();

    // IMPORTANT: enforce ordering (min, max)
    String userA = me.compareTo(other) <= 0 ? me : other;
    String userB = me.compareTo(other) <= 0 ? other : me;

    // Convert to UUID for repository call
    UUID userAId = UUID.fromString(userA);
    UUID userBId = UUID.fromString(userB);

    // Correct repository call
    var existing = convRepo.findByUser1IdAndUser2Id(userAId, userBId);
    if (existing.isPresent()) {
      return ResponseEntity.ok(new ConversationResponse(existing.get().getId().toString()));
    }

    ConversationEntity c = new ConversationEntity();
    c.setId(UUID.randomUUID());
    c.setUser1Id(userAId);
    c.setUser2Id(userBId);

    c = convRepo.save(c);
    return ResponseEntity.ok(new ConversationResponse(c.getId().toString()));
  }

  @GetMapping("/conversations/{id}/messages")
  public List<MessageStorageService.MessageDTO> getMessages(
      @AuthenticationPrincipal JwtPrincipal p,
      @PathVariable String id
  ) {
    UUID conversationId = UUID.fromString(id);
    var c = convRepo.findById(conversationId).orElseThrow();

    UUID userId = UUID.fromString(p.subject());
    if (!(c.getUser1Id().equals(userId) || c.getUser2Id().equals(userId))) {
      throw new RuntimeException("not allowed");
    }

    // Load from Cassandra with Redis caching
    return messageStorage.getRecentMessages(conversationId, 50);
  }
}
