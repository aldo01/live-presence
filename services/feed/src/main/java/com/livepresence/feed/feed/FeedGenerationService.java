package com.livepresence.feed.feed;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Async Feed Generation Service with Fan-Out on Write pattern
 * 
 * Strategy for scaling to millions of posts:
 * 1. Fan-out on Write: When a post is created, push it to followers' feeds asynchronously
 * 2. Redis Cache: Cache user feeds in Redis with TTL
 * 3. Async Processing: Use CompletableFuture for non-blocking operations
 * 4. Batch Processing: Process feed updates in batches
 * 5. Lazy Loading: Load feeds on demand with pagination
 */
@Service
public class FeedGenerationService {
    
    private static final Logger log = LoggerFactory.getLogger(FeedGenerationService.class);
    private static final String FEED_CACHE_PREFIX = "feed:";
    private static final int FEED_CACHE_TTL_MINUTES = 10;
    private static final int MAX_CACHED_POSTS = 50;
    
    private final RedisTemplate<String, String> redisTemplate;
    private final PostRepository postRepo;
    private final ObjectMapper objectMapper;
    
    public FeedGenerationService(
            RedisTemplate<String, String> redisTemplate,
            PostRepository postRepo,
            ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.postRepo = postRepo;
        this.objectMapper = objectMapper;
    }
    
    /**
     * Fan-out: When a new post is created, add it to nearby users' cached feeds
     * This runs asynchronously to not block the post creation
     */
    @Async
    public CompletableFuture<Void> fanOutPost(PostEntity post) {
        try {
            log.info("Starting fan-out for post {} by user {}", post.getId(), post.getUser().getId());
            
            // Get users within radius who should see this post
            // For now, we'll invalidate caches and let them regenerate on demand
            // In production, you'd query for nearby users and push to their feeds
            
            // Invalidate location-based feed caches
            // Pattern: feed:lat:lon:radius:interest
            String pattern = FEED_CACHE_PREFIX + "*";
            Set<String> keys = redisTemplate.keys(pattern);
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
                log.info("Invalidated {} feed caches for new post", keys.size());
            }
            
            return CompletableFuture.completedFuture(null);
        } catch (Exception e) {
            log.error("Error during feed fan-out", e);
            return CompletableFuture.failedFuture(e);
        }
    }
    
    /**
     * Get cached feed or generate new one
     */
    public Optional<List<Map<String, Object>>> getCachedFeed(
            double lat, double lon, double radiusKm, String interest) {
        try {
            String cacheKey = generateFeedCacheKey(lat, lon, radiusKm, interest);
            String cachedData = redisTemplate.opsForValue().get(cacheKey);
            
            if (cachedData != null) {
                List<Map<String, Object>> feed = objectMapper.readValue(
                    cachedData, 
                    objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class)
                );
                log.debug("Feed cache hit for key: {}", cacheKey);
                return Optional.of(feed);
            }
            
            return Optional.empty();
        } catch (JsonProcessingException e) {
            log.error("Error deserializing cached feed", e);
            return Optional.empty();
        }
    }
    
    /**
     * Cache the generated feed
     */
    @Async
    public void cacheFeed(double lat, double lon, double radiusKm, 
                         String interest, List<Map<String, Object>> feed) {
        try {
            String cacheKey = generateFeedCacheKey(lat, lon, radiusKm, interest);
            
            // Limit cached posts to prevent memory issues
            List<Map<String, Object>> limitedFeed = feed.size() > MAX_CACHED_POSTS 
                ? feed.subList(0, MAX_CACHED_POSTS) 
                : feed;
            
            String feedJson = objectMapper.writeValueAsString(limitedFeed);
            redisTemplate.opsForValue().set(
                cacheKey, 
                feedJson, 
                FEED_CACHE_TTL_MINUTES, 
                TimeUnit.MINUTES
            );
            
            log.debug("Cached feed with {} posts for key: {}", limitedFeed.size(), cacheKey);
        } catch (JsonProcessingException e) {
            log.error("Error caching feed", e);
        }
    }
    
    /**
     * Prefetch feeds for active users
     * Call this periodically for hot users/locations
     */
    @Async
    public CompletableFuture<Void> prefetchFeed(double lat, double lon, 
                                                 double radiusKm, String interest) {
        // This would generate and cache feed proactively
        // Useful for popular locations/users
        log.info("Prefetching feed for location: {}, {}", lat, lon);
        return CompletableFuture.completedFuture(null);
    }
    
    private String generateFeedCacheKey(double lat, double lon, double radiusKm, String interest) {
        // Round coordinates to reduce cache fragmentation
        double roundedLat = Math.round(lat * 100.0) / 100.0;
        double roundedLon = Math.round(lon * 100.0) / 100.0;
        return String.format("%s%.2f:%.2f:%.0f:%s", 
            FEED_CACHE_PREFIX, roundedLat, roundedLon, radiusKm, interest != null ? interest : "all");
    }
}
