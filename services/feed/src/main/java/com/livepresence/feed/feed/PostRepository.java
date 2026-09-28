package com.livepresence.feed.feed;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PostRepository extends JpaRepository<PostEntity, UUID> {

    /**
     * Find posts within radius (in kilometers) using Haversine formula
     * Formula: distance = 6371 * acos(cos(lat1) * cos(lat2) * cos(lon2 - lon1) + sin(lat1) * sin(lat2))
     */
    @Query(value = """
        SELECT p.*, u.display_name, u.email, u.avatar_url, u.live,
               (6371 * acos(cos(radians(:lat)) * cos(radians(p.location_lat)) * 
                cos(radians(p.location_lon) - radians(:lon)) + 
                sin(radians(:lat)) * sin(radians(p.location_lat)))) AS distance
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE (6371 * acos(cos(radians(:lat)) * cos(radians(p.location_lat)) * 
               cos(radians(p.location_lon) - radians(:lon)) + 
               sin(radians(:lat)) * sin(radians(p.location_lat)))) <= :radiusKm
        ORDER BY p.created_at DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Object[]> findPostsWithinRadius(
        @Param("lat") double lat,
        @Param("lon") double lon,
        @Param("radiusKm") double radiusKm,
        @Param("limit") int limit
    );

    /**
     * Find posts within radius filtered by interest
     */
    @Query(value = """
        SELECT p.*, u.display_name, u.email, u.avatar_url, u.live,
               (6371 * acos(cos(radians(:lat)) * cos(radians(p.location_lat)) * 
                cos(radians(p.location_lon) - radians(:lon)) + 
                sin(radians(:lat)) * sin(radians(p.location_lat)))) AS distance
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE (6371 * acos(cos(radians(:lat)) * cos(radians(p.location_lat)) * 
               cos(radians(p.location_lon) - radians(:lon)) + 
               sin(radians(:lat)) * sin(radians(p.location_lat)))) <= :radiusKm
        AND p.interest = :interest
        ORDER BY p.created_at DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Object[]> findPostsWithinRadiusByInterest(
        @Param("lat") double lat,
        @Param("lon") double lon,
        @Param("radiusKm") double radiusKm,
        @Param("interest") String interest,
        @Param("limit") int limit
    );

    /**
     * Location "vibe feed" — the Instagram-style feed of posts around the user.
     *
     * <p>Design notes:
     * <ul>
     *   <li>Columns are listed explicitly (not {@code p.*}) so the Java mapping
     *       is deterministic regardless of physical column order.</li>
     *   <li>A latitude/longitude bounding box is applied first so the
     *       {@code (location_lat, location_lon)} index can prune rows before the
     *       exact Haversine distance is computed — no full-table scan.</li>
     *   <li>{@code :vibe} is optional: when null/blank every vibe in range is
     *       returned; otherwise only posts with that vibe.</li>
     *   <li>Ordered newest-first (reverse-chronological), like Instagram.</li>
     * </ul>
     *
     * Columns returned (in order):
     * 0: id, 1: user_id, 2: content, 3: interest, 4: location_lat, 5: location_lon,
     * 6: image_url, 7: likes_count, 8: comments_count, 9: reactions_count,
     * 10: views_count, 11: created_at, 12: display_name, 13: avatar_url, 14: live,
     * 15: distance_km
     */
    @Query(value = """
        SELECT p.id, p.user_id, p.content, p.interest,
               p.location_lat, p.location_lon, p.image_url,
               p.likes_count, p.comments_count, p.reactions_count,
               p.views_count, p.created_at,
               u.display_name, u.avatar_url, u.live,
               (6371 * acos(LEAST(1.0, GREATEST(-1.0,
                   cos(radians(:lat)) * cos(radians(p.location_lat)) *
                   cos(radians(p.location_lon) - radians(:lon)) +
                   sin(radians(:lat)) * sin(radians(p.location_lat)))))) AS distance_km
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.location_lat BETWEEN :minLat AND :maxLat
          AND p.location_lon BETWEEN :minLon AND :maxLon
          AND (:vibe IS NULL OR :vibe = '' OR p.interest = :vibe)
          AND (6371 * acos(LEAST(1.0, GREATEST(-1.0,
                   cos(radians(:lat)) * cos(radians(p.location_lat)) *
                   cos(radians(p.location_lon) - radians(:lon)) +
                   sin(radians(:lat)) * sin(radians(p.location_lat)))))) <= :radiusKm
        ORDER BY p.created_at DESC
        LIMIT :limit OFFSET :offset
        """, nativeQuery = true)
    List<Object[]> findVibeFeed(
        @Param("lat") double lat,
        @Param("lon") double lon,
        @Param("minLat") double minLat,
        @Param("maxLat") double maxLat,
        @Param("minLon") double minLon,
        @Param("maxLon") double maxLon,
        @Param("radiusKm") double radiusKm,
        @Param("vibe") String vibe,
        @Param("limit") int limit,
        @Param("offset") int offset
    );

    // Find posts by user
    Page<PostEntity> findByUser_IdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    // Count posts by user
    long countByUser_Id(UUID userId);

    /**
     * Smart Feed Query with Follow Status and Online Status
     * Returns ALL posts ranked by:
     * 1. Online users in region (live = true, distance < radiusKm)
     * 2. Offline users in region (live = false, distance < radiusKm)
     * 3. All other users' posts (outside region)
     * 
     * Columns returned (in order):
     * 0: post.id, 1: post.user_id, 2: post.content, 3: post.interest,
     * 4: post.location_lat, 5: post.location_lon, 6: post.image_url,
     * 7: post.likes_count, 8: post.comments_count, 9: post.created_at,
     * 10: post.reactions_count, 11: user.display_name, 12: user.email,
     * 13: user.avatar_url, 14: user.live, 15: is_followed, 16: distance
     */
    @Query(value = """
        SELECT 
            p.id, p.user_id, p.content, p.interest,
            p.location_lat, p.location_lon, p.image_url,
            p.likes_count, p.comments_count, p.created_at, p.reactions_count,
            u.display_name, u.email, u.avatar_url, u.live,
            CASE WHEN uf.follower_id IS NOT NULL THEN true ELSE false END as is_followed,
            CASE 
                WHEN p.location_lat = 0 AND p.location_lon = 0 THEN 9999.0
                ELSE (6371 * acos(
                    LEAST(1.0, GREATEST(-1.0,
                        cos(radians(:lat)) * cos(radians(p.location_lat)) * 
                        cos(radians(p.location_lon) - radians(:lon)) + 
                        sin(radians(:lat)) * sin(radians(p.location_lat))
                    ))
                ))
            END as distance
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN user_followers uf ON uf.followed_id = p.user_id AND uf.follower_id = :userId
        WHERE p.user_id != :userId
        AND (:interest IS NULL OR :interest = '' OR p.interest = :interest)
        ORDER BY 
            CASE 
                WHEN u.live = true AND 
                    (CASE 
                        WHEN p.location_lat = 0 AND p.location_lon = 0 THEN 9999.0
                        ELSE (6371 * acos(
                            LEAST(1.0, GREATEST(-1.0,
                                cos(radians(:lat)) * cos(radians(p.location_lat)) * 
                                cos(radians(p.location_lon) - radians(:lon)) + 
                                sin(radians(:lat)) * sin(radians(p.location_lat))
                            ))
                        ))
                    END) <= :radiusKm THEN 1
                WHEN u.live = false AND 
                    (CASE 
                        WHEN p.location_lat = 0 AND p.location_lon = 0 THEN 9999.0
                        ELSE (6371 * acos(
                            LEAST(1.0, GREATEST(-1.0,
                                cos(radians(:lat)) * cos(radians(p.location_lat)) * 
                                cos(radians(p.location_lon) - radians(:lon)) + 
                                sin(radians(:lat)) * sin(radians(p.location_lat))
                            ))
                        ))
                    END) <= :radiusKm THEN 2
                ELSE 3
            END,
            CASE WHEN uf.follower_id IS NOT NULL THEN 1 ELSE 2 END,
            p.created_at DESC
        LIMIT :limit OFFSET :offset
        """, nativeQuery = true)
    List<Object[]> findSmartFeed(
        @Param("userId") UUID userId,
        @Param("lat") double lat,
        @Param("lon") double lon,
        @Param("radiusKm") int radiusKm,
        @Param("interest") String interest,
        @Param("limit") int limit,
        @Param("offset") int offset
    );
}
