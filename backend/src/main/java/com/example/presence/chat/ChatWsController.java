package com.example.presence.chat;

import com.example.presence.auth.JwtAuthFilter.JwtPrincipal;
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.time.Instant;
import java.util.UUID;

@Controller
public class ChatWsController {

  private final ConversationRepository convRepo;
  private final MessageStorageService messageStorage;
  private final SimpMessagingTemplate messaging;

  public ChatWsController(
      ConversationRepository convRepo, 
      MessageStorageService messageStorage,
      SimpMessagingTemplate messaging
  ) {
    this.convRepo = convRepo;
    this.messageStorage = messageStorage;
    this.messaging = messaging;
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
    String timestamp = Instant.now().toString();

    // Determine recipient
    UUID recipientId = c.getUser1Id().equals(userId) ? c.getUser2Id() : c.getUser1Id();

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
            body.length() > 50 ? body.substring(0, 50) + "..." : body,
            messageType,
            timestamp
        )
    );
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
