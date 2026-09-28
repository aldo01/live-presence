package com.example.presence.kafka.producers;

import com.example.presence.kafka.events.FeedUpdateEvent;
import com.example.presence.kafka.events.PostEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.util.concurrent.CompletableFuture;

/**
 * Event Publisher Service
 * Publishes events to Kafka topics for async processing
 */
@Service
@ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true")
public class EventPublisher {
    
    private static final Logger log = LoggerFactory.getLogger(EventPublisher.class);
    
    private static final String POST_CREATED_TOPIC = "post.created";
    private static final String POST_UPDATED_TOPIC = "post.updated";
    private static final String POST_DELETED_TOPIC = "post.deleted";
    private static final String FEED_UPDATE_TOPIC = "feed.update";

    @Autowired
    private KafkaTemplate<String, Object> kafkaTemplate;

    /**
     * Publish post created event
     */
    public void publishPostCreated(PostEvent event) {
        publish(POST_CREATED_TOPIC, event.getPostId(), event);
    }

    /**
     * Publish post updated event
     */
    public void publishPostUpdated(PostEvent event) {
        publish(POST_UPDATED_TOPIC, event.getPostId(), event);
    }

    /**
     * Publish post deleted event
     */
    public void publishPostDeleted(PostEvent event) {
        publish(POST_DELETED_TOPIC, event.getPostId(), event);
    }

    /**
     * Publish feed update event
     */
    public void publishFeedUpdate(FeedUpdateEvent event) {
        publish(FEED_UPDATE_TOPIC, event.getUserId(), event);
    }

    /**
     * Generic publish method with error handling
     */
    private void publish(String topic, String key, Object event) {
        try {
            CompletableFuture<SendResult<String, Object>> future = 
                kafkaTemplate.send(topic, key, event);
            
            future.whenComplete((result, ex) -> {
                if (ex != null) {
                    log.error("Failed to publish event to topic {}: {}", topic, ex.getMessage());
                } else {
                    log.debug("Published event to topic {} partition {} offset {}", 
                        topic, 
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
                }
            });
        } catch (Exception e) {
            log.error("Error publishing event to topic {}: {}", topic, e.getMessage(), e);
        }
    }
}
