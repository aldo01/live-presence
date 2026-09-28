package com.example.presence.notifications;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Delivers notification events produced by the notification-service to the
 * recipient's live WebSocket session. Core owns the in-memory STOMP broker
 * where clients connect, so it subscribes to the {@code notif.deliver} Redis
 * channel and forwards each event via {@code convertAndSendToUser}.
 */
@Configuration
public class NotificationDeliverySubscriber {

  private static final Logger log = LoggerFactory.getLogger(NotificationDeliverySubscriber.class);
  public static final String DELIVER_CHANNEL = "notif.deliver";

  @Bean
  public RedisMessageListenerContainer notificationDeliveryContainer(
      RedisConnectionFactory connectionFactory,
      SimpMessagingTemplate messaging,
      ObjectMapper mapper) {

    MessageListener listener = (Message message, byte[] pattern) -> {
      try {
        String body = new String(message.getBody(), StandardCharsets.UTF_8);
        JsonNode node = mapper.readTree(body);
        String recipientId = node.path("recipientId").asText(null);
        if (recipientId == null || recipientId.isBlank()) return;

        // Forward the event as-is (minus the routing field) to the user's queue.
        Map<String, Object> event = mapper.convertValue(node, LinkedHashMap.class);
        event.remove("recipientId");

        messaging.convertAndSendToUser(recipientId, "/queue/notifications", event);
      } catch (Exception e) {
        log.error("Failed to deliver notification event: {}", e.getMessage());
      }
    };

    RedisMessageListenerContainer container = new RedisMessageListenerContainer();
    container.setConnectionFactory(connectionFactory);
    container.addMessageListener(listener, new PatternTopic(DELIVER_CHANNEL));
    return container;
  }
}
