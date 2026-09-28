package com.livepresence.auth.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Publishes identity lifecycle events so the core service can pre-provision a
 * profile. Kafka is optional in local development — when it is disabled the
 * template is absent and this degrades to a debug log, because core also
 * provisions lazily from the JWT.
 */
@Component
public class UserEventPublisher {

  public static final String TOPIC_USER_REGISTERED = "user.registered";

  private static final Logger log = LoggerFactory.getLogger(UserEventPublisher.class);

  private final KafkaTemplate<String, String> kafka;
  private final ObjectMapper objectMapper;

  public UserEventPublisher(
      @Autowired(required = false) KafkaTemplate<String, String> kafka,
      ObjectMapper objectMapper
  ) {
    this.kafka = kafka;
    this.objectMapper = objectMapper;
  }

  public record UserRegisteredEvent(String userId, String email, String displayName, String occurredAt) {}

  public void publishUserRegistered(UUID userId, String email, String displayName) {
    if (kafka == null) {
      log.debug("kafka disabled — skipping user.registered for {}", userId);
      return;
    }
    try {
      var event = new UserRegisteredEvent(
          userId.toString(), email, displayName, Instant.now().toString());
      kafka.send(TOPIC_USER_REGISTERED, userId.toString(), objectMapper.writeValueAsString(event));
    } catch (Exception e) {
      // Never fail a registration because the broker is unhappy.
      log.warn("failed to publish user.registered for {}: {}", userId, e.getMessage());
    }
  }
}
