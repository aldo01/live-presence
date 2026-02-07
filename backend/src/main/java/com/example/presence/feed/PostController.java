package com.example.presence.feed;

import com.example.presence.auth.JwtService;
import io.jsonwebtoken.Claims;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostService postService;
    private final JwtService jwtService;

    @Autowired
    private SmartFeedService smartFeedService;

    public PostController(PostService postService, JwtService jwtService) {
        this.postService = postService;
        this.jwtService = jwtService;
    }

    private String getUserIdFromToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("Invalid authorization header");
        }
        String token = authHeader.substring(7);
        var jws = jwtService.parse(token);
        return jws.getPayload().getSubject(); // This is already a String (UUID)
    }

    @PostMapping
    public ResponseEntity<?> createPost(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody CreatePostRequest req) {
        try {
            String userId = getUserIdFromToken(authHeader);

            PostEntity post = postService.createPost(
                userId,
                req.content(),
                req.interest(),
                req.lat(),
                req.lon(),
                req.imageUrl()
            );

            // Invalidate feed cache for nearby users (fan-out on write)
            smartFeedService.invalidateFeedCache(UUID.fromString(userId), req.lat(), req.lon());

            Map<String, Object> response = new HashMap<>();
            response.put("id", post.getId().toString());
            response.put("content", post.getContent());
            response.put("interest", post.getInterest());
            response.put("createdAt", post.getCreatedAt());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/feed")
    public ResponseEntity<?> getFeed(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam double lat,
            @RequestParam double lon,
            @RequestParam(defaultValue = "10") double radiusKm,
            @RequestParam(required = false) String interest,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        try {
            // Max radius is 100km for smart feed
            if (radiusKm > 100) {
                radiusKm = 100;
            }

            String currentUserId = null;
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                try {
                    currentUserId = getUserIdFromToken(authHeader);
                } catch (Exception e) {
                    // Ignore auth errors for feed
                }
            }

            // Use smart feed if user is authenticated
            if (currentUserId != null) {
                List<Map<String, Object>> smartFeed = smartFeedService.getSmartFeed(
                    UUID.fromString(currentUserId), 
                    lat, 
                    lon, 
                    (int) radiusKm,
                    interest,
                    limit,
                    offset
                );
                return ResponseEntity.ok(smartFeed);
            }

            // Fallback to regular feed for unauthenticated users
            List<Map<String, Object>> feed = postService.getFeed(lat, lon, radiusKm, interest, limit, currentUserId);
            return ResponseEntity.ok(feed);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getPost(@PathVariable String id) {
        return postService.getPost(id)
            .map(post -> ResponseEntity.ok(Map.of(
                "id", post.getId().toString(),
                "userId", post.getUser().getId().toString(),
                "content", post.getContent(),
                "interest", post.getInterest(),
                "locationLat", post.getLocationLat(),
                "locationLon", post.getLocationLon(),
                "imageUrl", post.getImageUrl(),
                "likesCount", post.getLikesCount(),
                "commentsCount", post.getCommentsCount(),
                "createdAt", post.getCreatedAt()
            )))
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePost(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id) {
        try {
            String userId = getUserIdFromToken(authHeader);
            postService.deletePost(id, userId);
            return ResponseEntity.ok(Map.of("message", "Post deleted"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<?> toggleLike(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id) {
        try {
            String userId = getUserIdFromToken(authHeader);
            boolean liked = postService.toggleLike(id, userId);
            return ResponseEntity.ok(Map.of("liked", liked));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<?> addComment(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody CommentRequest req) {
        try {
            String userId = getUserIdFromToken(authHeader);
            PostCommentEntity comment = postService.addComment(id, userId, req.content());

            return ResponseEntity.ok(Map.of(
                "id", comment.getId().toString(),
                "content", comment.getContent(),
                "createdAt", comment.getCreatedAt()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<?> getComments(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            var commentsPage = postService.getCommentsPaginated(id, page, size);
            return ResponseEntity.ok(Map.of(
                "comments", commentsPage.getContent().stream().map(c -> Map.of(
                    "id", c.getId().toString(),
                    "userId", c.getUser().getId().toString(),
                    "authorName", c.getUser().getDisplayName(),
                    "content", c.getContent(),
                    "createdAt", c.getCreatedAt()
                )).toList(),
                "totalPages", commentsPage.getTotalPages(),
                "totalElements", commentsPage.getTotalElements(),
                "currentPage", page,
                "hasMore", commentsPage.hasNext()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/view")
    public ResponseEntity<?> incrementView(
            @PathVariable String id) {
        try {
            postService.incrementView(id);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/has-liked")
    public ResponseEntity<?> hasLiked(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id) {
        try {
            String userId = getUserIdFromToken(authHeader);
            boolean hasLiked = postService.hasUserLiked(id, userId);
            return ResponseEntity.ok(Map.of("hasLiked", hasLiked));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Reaction endpoints
    @PostMapping("/{id}/react")
    public ResponseEntity<?> reactToPost(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody ReactRequest req) {
        try {
            String userId = getUserIdFromToken(authHeader);
            postService.reactToPost(id, userId, req.reactionType());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}/react")
    public ResponseEntity<?> removeReaction(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id) {
        try {
            String userId = getUserIdFromToken(authHeader);
            postService.removeReaction(id, userId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/reactions")
    public ResponseEntity<?> getReactions(@PathVariable String id) {
        try {
            Map<String, Long> reactions = postService.getReactionCounts(id);
            return ResponseEntity.ok(reactions);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // DTOs
    record CreatePostRequest(String content, String interest, double lat, double lon, String imageUrl) {}
    record CommentRequest(String content) {}
    record ReactRequest(String reactionType) {}
}
