package com.example.presence.chat;

import com.example.presence.auth.JwtAuthFilter.JwtPrincipal;
import com.example.presence.user.UserEntity;
import com.example.presence.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class ChatController {

  private final ConversationRepository convRepo;
  private final MessageStorageService messageStorage;
  private final UserRepository userRepo;

  public ChatController(ConversationRepository convRepo, MessageStorageService messageStorage, UserRepository userRepo) {
    this.convRepo = convRepo;
    this.messageStorage = messageStorage;
    this.userRepo = userRepo;
  }

  public record CreateConversationRequest(String targetUserId) {}
  public record ConversationResponse(String conversationId) {}

  public record ConversationListItem(
      String conversationId,
      String otherUserId,
      String otherDisplayName,
      String otherAvatarUrl,
      boolean otherLive,
      String lastMessagePreview,
      String lastMessageAt,
      int unreadCount
  ) {}

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

  @GetMapping("/conversations")
  public List<ConversationListItem> listConversations(@AuthenticationPrincipal JwtPrincipal p) {
    UUID me = UUID.fromString(p.subject());
    List<ConversationEntity> conversations = convRepo.findByUser1IdOrUser2Id(me, me);

    // Sort newest first, nulls last.
    conversations.sort((a, b) -> {
      Instant ta = a.getLastMessageAt();
      Instant tb = b.getLastMessageAt();
      if (ta == null && tb == null) return b.getCreatedAt().compareTo(a.getCreatedAt());
      if (ta == null) return 1;
      if (tb == null) return -1;
      return tb.compareTo(ta);
    });

    List<UUID> otherUserIds = conversations.stream()
        .map(c -> c.getUser1Id().equals(me) ? c.getUser2Id() : c.getUser1Id())
        .filter(Objects::nonNull)
        .distinct()
        .toList();

    Map<UUID, UserEntity> usersById = userRepo.findAllById(otherUserIds)
        .stream()
        .collect(Collectors.toMap(UserEntity::getId, Function.identity()));

    return conversations.stream().map(c -> {
      UUID otherId = c.getUser1Id().equals(me) ? c.getUser2Id() : c.getUser1Id();
      UserEntity other = usersById.get(otherId);

      int unread = 0;
      if (c.getUser1Id().equals(me)) unread = c.getUser1Unread() != null ? c.getUser1Unread() : 0;
      if (c.getUser2Id().equals(me)) unread = c.getUser2Unread() != null ? c.getUser2Unread() : 0;

      return new ConversationListItem(
          c.getId().toString(),
          otherId != null ? otherId.toString() : null,
          other != null ? other.getDisplayName() : "User",
          other != null ? other.getAvatarUrl() : null,
          other != null && other.isLive(),
          c.getLastMessagePreview(),
          c.getLastMessageAt() != null ? c.getLastMessageAt().toString() : null,
          unread
      );
    }).toList();
  }

  @PostMapping("/conversations/{id}/read")
  public ResponseEntity<?> markConversationRead(
      @AuthenticationPrincipal JwtPrincipal p,
      @PathVariable String id
  ) {
    UUID conversationId = UUID.fromString(id);
    ConversationEntity c = convRepo.findById(conversationId).orElseThrow();
    UUID me = UUID.fromString(p.subject());

    if (c.getUser1Id().equals(me)) {
      c.setUser1Unread(0);
    } else if (c.getUser2Id().equals(me)) {
      c.setUser2Unread(0);
    } else {
      return ResponseEntity.status(403).body("not allowed");
    }

    convRepo.save(c);
    return ResponseEntity.ok().build();
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
