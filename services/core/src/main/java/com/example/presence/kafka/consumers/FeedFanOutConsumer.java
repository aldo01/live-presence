package com.example.presence.kafka.consumers;

import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.example.presence.kafka.events.FeedUpdateEvent;
import com.example.presence.kafka.events.PostEvent;
import com.example.presence.kafka.producers.EventPublisher;
import com.example.presence.user.UserFollowRepository;

/**
 * Feed Fan-Out Consumer
 * Listens to post.created events and fans out to relevant users' feeds
 * 
 * Strategy:
 * 1. When post is created, identify all users who should see it
 * 2. Publish feed update events for each user
 * 3. Send WebSocket notifications to online users
 * 4. Invalidate relevant Redis caches
 */
@Service
@ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true")
public class FeedFanOutConsumer {
    
    private static final Logger log = LoggerFactory.getLogger(FeedFanOutConsumer.class);
    private static final int MAX_RADIUS_KM = 20;

    @Autowired
    private UserFollowRepository followRepository;

    @Autowired
    private NearbyUserLookup nearbyUserLookup;

    @Autowired
    private EventPublisher eventPublisher;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Process post created events and fan out to relevant feeds
     */
    @KafkaListener(topics = "post.created", groupId = "${spring.kafka.consumer.group-id}")
    public void handlePostCreated(PostEvent event) {
        try {
            log.info("Processing post.created event: {}", event);

            String postAuthorId = event.getUserId();
            
            // 1. Fan out to followers
            fanOutToFollowers(event, postAuthorId);
            
            // 2. Fan out to nearby users (if location-based post)
            if (event.getLocationLat() != null && event.getLocationLon() != null &&
                event.getLocationLat() != 0 && event.getLocationLon() != 0) {
                fanOutToNearbyUsers(event);
            }
            
            // 3. Invalidate feed caches
            invalidateFeedCaches();
            
            // 4. Send WebSocket notification to online users
            notifyOnlineUsers(event);
            
            log.info("Successfully processed post.created event for post {}", event.getPostId());
            
        } catch (Exception e) {
            log.error("Error processing post.created event: {}", e.getMessage(), e);
            // In production, send to DLQ (Dead Letter Queue)
        }
    }

    /**
     * Fan out to all followers of the post author
     */
    private void fanOutToFollowers(PostEvent event, String postAuthorId) {
        try {
            // Get all followers of the post author
            List<UUID> followerIds = followRepository.findFollowerIdsByFollowedId(UUID.fromString(postAuthorId));
            
            log.debug("Fanning out to {} followers", followerIds.size());
            
            for (UUID followerId : followerIds) {
                FeedUpdateEvent feedEvent = new FeedUpdateEvent(
                    followerId.toString(),
                    event.getPostId(),
                    event.getUserId(),
                    event.getInterest(),
                    FeedUpdateEvent.UpdateReason.NEW_POST
                );
                
                eventPublisher.publishFeedUpdate(feedEvent);
            }
        } catch (Exception e) {
            log.error("Error fanning out to followers: {}", e.getMessage());
        }
    }

    /**
     * Fan out to users in proximity of the post location
     */
    private void fanOutToNearbyUsers(PostEvent event) {
        try {
            // Get nearby users from Redis geospatial data (written by presence-service)
            List<String> nearbyUserIds = nearbyUserLookup.getNearbyUserIds(
                event.getLocationLat(), 
                event.getLocationLon(), 
                MAX_RADIUS_KM
            );
            
            log.debug("Fanning out to {} nearby users", nearbyUserIds.size());
            
            for (String userId : nearbyUserIds) {
                // Don't send to post author
                if (userId.equals(event.getUserId())) {
                    continue;
                }
                
                FeedUpdateEvent feedEvent = new FeedUpdateEvent(
                    userId,
                    event.getPostId(),
                    event.getUserId(),
                    event.getInterest(),
                    FeedUpdateEvent.UpdateReason.NEARBY_POST
                );
                
                eventPublisher.publishFeedUpdate(feedEvent);
            }
        } catch (Exception e) {
            log.error("Error fanning out to nearby users: {}", e.getMessage());
        }
    }

    /**
     * Invalidate all feed caches in Redis
     */
    private void invalidateFeedCaches() {
        try {
            var keys = redisTemplate.keys("feed:*");
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
                log.debug("Invalidated {} feed cache keys", keys.size());
            }
        } catch (Exception e) {
            log.error("Error invalidating feed caches: {}", e.getMessage());
        }
    }

    /**
     * Send WebSocket notifications to online users
     */
    private void notifyOnlineUsers(PostEvent event) {
        try {
            // Broadcast to /topic/feed/new-post for all subscribed users
            messagingTemplate.convertAndSend("/topic/feed/new-post", event);
            log.debug("Sent WebSocket notification for new post {}", event.getPostId());
        } catch (Exception e) {
            log.error("Error sending WebSocket notification: {}", e.getMessage());
        }
    }
}
