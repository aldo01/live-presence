package com.livepresence.notification;

import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Subscribes to the {@code notif.create} Redis channel and hands each request
 * to the ingest service. This is the ingestion boundary of the service.
 */
@Configuration
public class RedisListenerConfig {

  private static final Logger log = LoggerFactory.getLogger(RedisListenerConfig.class);
  public static final String CREATE_CHANNEL = "notif.create";

  @Bean
  public RedisMessageListenerContainer notificationListenerContainer(
      RedisConnectionFactory connectionFactory,
      NotificationIngestService ingestService,
      ObjectMapper mapper) {

    MessageListener listener = (Message message, byte[] pattern) -> {
      try {
        String body = new String(message.getBody(), StandardCharsets.UTF_8);
        NotificationCreateRequest req = mapper.readValue(body, NotificationCreateRequest.class);
        ingestService.ingest(req);
      } catch (Exception e) {
        log.error("Failed to process notif.create message: {}", e.getMessage());
      }
    };

    RedisMessageListenerContainer container = new RedisMessageListenerContainer();
    container.setConnectionFactory(connectionFactory);
    container.addMessageListener(listener, new PatternTopic(CREATE_CHANNEL));
    return container;
  }
}
