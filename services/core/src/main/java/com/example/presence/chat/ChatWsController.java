package com.example.presence.chat;

import com.example.presence.auth.JwtAuthFilter.JwtPrincipal;
import com.example.presence.notifications.NotificationService;
import com.example.presence.user.UserRepository;
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Controller
public class ChatWsController {

  private final ConversationRepository convRepo;
  private final MessageStorageService messageStorage;
  private final SimpMessagingTemplate messaging;
  private final NotificationService notificationService;
  private final UserRepository userRepo;

  public ChatWsController(
      ConversationRepository convRepo, 
      MessageStorageService messageStorage,
      SimpMessagingTemplate messaging,
      NotificationService notificationService,
      UserRepository userRepo
  ) {
    this.convRepo = convRepo;
    this.messageStorage = messageStorage;
    this.messaging = messaging;
    this.notificationService = notificationService;
    this.userRepo = userRepo;
  }

  public record SendMessage(String body, String messageType, String mediaUrl) {}
  public record MessageEvent(
      String messageId,
      String conversationId, 
      String senderId, 
      String body, 
      String messageType,
      String mediaUrl,
      String createdAtIso
  ) {}

  @MessageMapping("/chat.send/{conversationId}")
  public void send(@DestinationVariable String conversationId, SendMessage msg, Authentication auth) {
    var principal = (org.springframework.security.authentication.UsernamePasswordAuthenticationToken) auth;
    var p = (com.example.presence.auth.JwtAuthFilter.JwtPrincipal) principal.getPrincipal();
    
    UUID conversationUuid = UUID.fromString(conversationId);
    var c = convRepo.findById(conversationUuid).orElseThrow();

    UUID userId = UUID.fromString(p.subject());
    if (!(c.getUser1Id().equals(userId) || c.getUser2Id().equals(userId))) {
      return; // ignore unauthorized
    }
    
    String messageType = msg.messageType() != null ? msg.messageType() : "text";
    String body = msg.body() != null ? msg.body().trim() : "";
    String mediaUrl = msg.mediaUrl();
    
    // Allow empty body if it's an image message
    if (body.isBlank() && !"image".equals(messageType)) return;
    if (body.length() > 5000) return;

    UUID messageId = UUID.randomUUID();
    Instant now = Instant.now();
    String timestamp = now.toString();

    // Determine recipient
    UUID recipientId = c.getUser1Id().equals(userId) ? c.getUser2Id() : c.getUser1Id();

    var sender = userRepo.findById(userId).orElse(null);

    // Update conversation metadata (for Messenger-style conversation list)
    String preview;
    if ("image".equals(messageType)) {
      preview = "[Photo]";
    } else {
      preview = body.length() > 80 ? body.substring(0, 80) + "..." : body;
    }
    c.setLastMessageAt(now);
    c.setLastMessagePreview(preview);

    Integer u1 = c.getUser1Unread() != null ? c.getUser1Unread() : 0;
    Integer u2 = c.getUser2Unread() != null ? c.getUser2Unread() : 0;
    if (recipientId.equals(c.getUser1Id())) {
      c.setUser1Unread(u1 + 1);
    } else {
      c.setUser2Unread(u2 + 1);
    }
    convRepo.save(c);

    // Save to Cassandra + Redis cache (async, non-blocking)
    messageStorage.saveMessage(conversationUuid, messageId, userId, body, messageType, mediaUrl);

    // Broadcast to conversation topic (instant delivery)
    MessageEvent event = new MessageEvent(
        messageId.toString(),
        conversationId, 
        userId.toString(), 
        body,
        messageType,
        mediaUrl,
        timestamp
    );
    messaging.convertAndSend("/topic/chat/" + conversationId, event);
    
    // Send personal notification to recipient (Facebook-style)
    messaging.convertAndSendToUser(
        recipientId.toString(),
        "/queue/messages",
        new MessageNotification(
            conversationId,
            userId.toString(),
            p.name(),
        preview,
            messageType,
            timestamp
        )
    );

    // Persist + push bell notifications (best-effort)
    if (sender != null) {
      try {
        notificationService.notifyMessageReceived(recipientId, sender, conversationUuid, preview);
      } catch (Exception ignored) {
        // best-effort
      }
    }
  }
  
  public record MessageNotification(
      String conversationId,
      String senderId,
      String senderName,
      String preview,
      String messageType,
      String timestamp
  ) {}
}
