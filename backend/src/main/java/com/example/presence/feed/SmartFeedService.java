package com.example.presence.feed;

import com.example.presence.user.UserEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Smart Feed Service implementing Facebook-style feed ranking
 * 
 * Feed Priority Algorithm:
 * 1. Online users in region (within radius) - HIGHEST priority
 * 2. Followed users' posts - HIGH priority
 * 3. Other users' posts (offline/outside region) - NORMAL priority
 * 
 * Uses Redis for caching hot feeds (1 minute TTL)
 * Implements fan-out on write pattern for scalability
 */
@Service
public class SmartFeedService {

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    private static final int FEED_PAGE_SIZE = 20;
    private static final int CACHE_TTL_SECONDS = 60; // 1 minute cache

    /**
     * Get smart feed with intelligent ranking
     * 
     * @param userId Current user's ID
     * @param userLat Current user's latitude
     * @param userLon Current user's longitude
     * @param radiusKm Search radius in kilometers
     * @param interest Interest filter (null for all)
     * @param limit Maximum posts to return
     * @param offset Offset for pagination
     * @return Ranked list of feed posts
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getSmartFeed(UUID userId, double userLat, double userLon, 
                                                    int radiusKm, String interest, int limit, int offset) {
        // Skip cache for pagination (offset > 0)
        if (offset == 0) {
            String interestKey = (interest == null || interest.isEmpty()) ? "all" : interest;
            String cacheKey = String.format("feed:%s:%.4f:%.4f:%d:%s", userId, userLat, userLon, radiusKm, interestKey);
            List<Map<String, Object>> cachedFeed = (List<Map<String, Object>>) redisTemplate.opsForValue().get(cacheKey);
            
            if (cachedFeed != null) {
                return cachedFeed.stream().limit(limit).collect(Collectors.toList());
            }
        }

        // Fetch posts with smart ranking from database
        List<Object[]> rawPosts = postRepository.findSmartFeed(userId, userLat, userLon, radiusKm, interest, limit, offset);
        
        // Convert to DTO and apply ranking algorithm
        List<Map<String, Object>> rankedFeed = rankPosts(rawPosts, userId);
        
        // Only cache first page
        if (offset == 0) {
            String interestKey = (interest == null || interest.isEmpty()) ? "all" : interest;
            String cacheKey = String.format("feed:%s:%.4f:%.4f:%d:%s", userId, userLat, userLon, radiusKm, interestKey);
            redisTemplate.opsForValue().set(cacheKey, rankedFeed, CACHE_TTL_SECONDS, TimeUnit.SECONDS);
        }
        
        return rankedFeed;
    }

    /**
     * Rank posts using Facebook-style algorithm:
     * Priority: Online in range > Offline in range > All others
     * Sub-priority: Followed users > Recency > Engagement
     */
    private List<Map<String, Object>> rankPosts(List<Object[]> rawPosts, UUID userId) {
        List<Map<String, Object>> posts = new ArrayList<>();
        
        for (Object[] row : rawPosts) {
            Map<String, Object> post = new HashMap<>();
            
            // Post fields - convert to proper Java types
            post.put("id", row[0] != null ? row[0].toString() : null);
            post.put("userId", row[1] != null ? row[1].toString() : null);
            post.put("content", row[2] != null ? row[2].toString() : null);
            post.put("interest", row[3] != null ? row[3].toString() : null);
            post.put("locationLat", row[4] != null ? ((Number) row[4]).doubleValue() : null);
            post.put("locationLon", row[5] != null ? ((Number) row[5]).doubleValue() : null);
            post.put("imageUrl", row[6] != null ? row[6].toString() : null);
            post.put("likesCount", row[7] != null ? ((Number) row[7]).intValue() : 0);
            post.put("commentsCount", row[8] != null ? ((Number) row[8]).intValue() : 0);
            
            // Convert Timestamp to ISO string for JSON serialization
            if (row[9] instanceof Timestamp) {
                Timestamp ts = (Timestamp) row[9];
                post.put("createdAt", ts.toInstant().atOffset(ZoneOffset.UTC).toString());
            } else {
                post.put("createdAt", row[9] != null ? row[9].toString() : null);
            }
            
            post.put("reactionsCount", row[10] != null ? ((Number) row[10]).intValue() : 0);
            
            // User fields - convert to proper Java types and map to frontend expected names
            String displayName = row[11] != null ? row[11].toString() : null;
            post.put("authorName", displayName); // Frontend expects authorName
            post.put("displayName", displayName); // Keep for backwards compatibility
            post.put("authorId", row[1] != null ? row[1].toString() : null); // Frontend expects authorId
            post.put("email", row[12] != null ? row[12].toString() : null);
            post.put("avatarUrl", row[13] != null ? row[13].toString() : null);
            
            // Ranking signals
            boolean isLive = row[14] != null && (Boolean) row[14];
            boolean isFollowed = row[15] != null && (Boolean) row[15];
            Double distance = row[16] != null ? ((Number) row[16]).doubleValue() : 9999.0;
            
            post.put("authorLive", isLive); // Frontend expects authorLive
            post.put("live", isLive); // Keep for backwards compatibility
            post.put("isFollowed", isFollowed);
            post.put("distance", distance);
            
            // Posts are already ordered by SQL query, so we just convert them
            posts.add(post);
        }
        
        return posts;
    }

    /**
     * Invalidate feed cache when new post is created (fan-out on write)
     */
    public void invalidateFeedCache(UUID posterId, double lat, double lon) {
        // In production, use Kafka to publish event
        // For now, clear nearby user caches
        String pattern = "feed:*";
        Set<String> keys = redisTemplate.keys(pattern);
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }

    /**
     * Pre-compute feed for user (for background job)
     * This can be triggered by Kafka consumer in production
     */
    public void preComputeFeed(UUID userId, double userLat, double userLon, int radiusKm) {
        String cacheKey = String.format("feed:%s:%.4f:%.4f:%d:all", userId, userLat, userLon, radiusKm);
        List<Map<String, Object>> feed = getSmartFeed(userId, userLat, userLon, radiusKm, null, FEED_PAGE_SIZE, 0);
        redisTemplate.opsForValue().set(cacheKey, feed, CACHE_TTL_SECONDS, TimeUnit.SECONDS);
    }
}
