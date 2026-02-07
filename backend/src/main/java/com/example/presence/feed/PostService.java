package com.example.presence.feed;

import com.example.presence.kafka.events.PostEvent;
import com.example.presence.kafka.producers.EventPublisher;
import com.example.presence.user.UserEntity;
import com.example.presence.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class PostService {

    private final PostRepository postRepo;
    private final PostLikeRepository postLikeRepo;
    private final PostCommentRepository postCommentRepo;
    private final ReactionRepository reactionRepo;
    private final UserRepository userRepo;

    @Autowired
    private EventPublisher eventPublisher;

    public PostService(PostRepository postRepo, PostLikeRepository postLikeRepo,
                      PostCommentRepository postCommentRepo, ReactionRepository reactionRepo,
                      UserRepository userRepo) {
        this.postRepo = postRepo;
        this.postLikeRepo = postLikeRepo;
        this.postCommentRepo = postCommentRepo;
        this.reactionRepo = reactionRepo;
        this.userRepo = userRepo;
    }

    @Transactional
    public PostEntity createPost(String userIdStr, String content, String interest,
                                 double lat, double lon, String imageUrl) {
        UUID userId = UUID.fromString(userIdStr);
        UserEntity user = userRepo.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        PostEntity post = new PostEntity();
        post.setId(UUID.randomUUID());
        post.setUser(user);
        post.setContent(content);
        post.setInterest(interest);
        post.setLocationLat(lat);
        post.setLocationLon(lon);
        post.setImageUrl(imageUrl);

        PostEntity savedPost = postRepo.save(post);

        // Publish Kafka event for async fan-out
        PostEvent event = new PostEvent(
            savedPost.getId().toString(),
            userId.toString(),
            content,
            interest,
            lat,
            lon,
            PostEvent.EventType.CREATED
        );
        eventPublisher.publishPostCreated(event);

        return savedPost;
    }

    public List<Map<String, Object>> getFeed(double lat, double lon, double radiusKm,
                                              String interest, int limit, String currentUserId) {
        List<Object[]> results;

        if (interest != null && !interest.isBlank()) {
            results = postRepo.findPostsWithinRadiusByInterest(lat, lon, radiusKm, interest, limit);
        } else {
            results = postRepo.findPostsWithinRadius(lat, lon, radiusKm, limit);
        }

        UUID userId = currentUserId != null ? UUID.fromString(currentUserId) : null;

        List<Map<String, Object>> feed = new ArrayList<>();
        for (Object[] row : results) {
            Map<String, Object> post = new HashMap<>();
            UUID postId = (UUID) row[0];
            post.put("id", postId.toString());
            post.put("authorId", row[1] != null ? row[1].toString() : null);
            post.put("content", row[2]);
            post.put("interest", row[3]);
            post.put("locationLat", row[4]);
            post.put("locationLon", row[5]);
            post.put("imageUrl", row[6]);
            post.put("likeCount", row[7]);
            post.put("commentsCount", row[8]);
            post.put("createdAt", row[9]);
            post.put("updatedAt", row[10]);
            post.put("viewsCount", row[11]);
            post.put("reactionsCount", row[12]);
            post.put("authorName", row[13]);
            post.put("authorEmail", row[14]);
            post.put("authorAvatar", row[15]);
            post.put("authorIsLive", row[16]);
            post.put("distance", row[17]);

            // Check if current user liked this post
            if (userId != null) {
                boolean likedByMe = postLikeRepo.existsByPost_IdAndUser_Id(postId, userId);
                post.put("likedByMe", likedByMe);
            } else {
                post.put("likedByMe", false);
            }

            // Get recent comments (last 3)
            List<PostCommentEntity> recentComments = postCommentRepo.findTop3ByPost_IdOrderByCreatedAtDesc(postId);
            List<Map<String, Object>> commentsData = new ArrayList<>();
            for (PostCommentEntity comment : recentComments) {
                Map<String, Object> commentMap = new HashMap<>();
                commentMap.put("id", comment.getId().toString());
                commentMap.put("content", comment.getContent());
                commentMap.put("authorName", comment.getUser().getDisplayName());
                commentMap.put("createdAt", comment.getCreatedAt());
                commentsData.add(commentMap);
            }
            post.put("comments", commentsData);

            feed.add(post);
        }

        return feed;
    }

    public Optional<PostEntity> getPost(String postIdStr) {
        UUID postId = UUID.fromString(postIdStr);
        return postRepo.findById(postId);
    }

    @Transactional
    public void deletePost(String postIdStr, String userIdStr) {
        UUID postId = UUID.fromString(postIdStr);
        UUID userId = UUID.fromString(userIdStr);
        
        PostEntity post = postRepo.findById(postId)
            .orElseThrow(() -> new RuntimeException("Post not found"));

        if (!post.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }

        postRepo.delete(post);
    }

    @Transactional
    public boolean toggleLike(String postIdStr, String userIdStr) {
        UUID postId = UUID.fromString(postIdStr);
        UUID userId = UUID.fromString(userIdStr);
        
        PostEntity post = postRepo.findById(postId)
            .orElseThrow(() -> new RuntimeException("Post not found"));

        UserEntity user = userRepo.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        Optional<PostLikeEntity> existingLike = postLikeRepo.findByPost_IdAndUser_Id(postId, userId);

        if (existingLike.isPresent()) {
            // Unlike
            postLikeRepo.delete(existingLike.get());
            post.setLikesCount(post.getLikesCount() - 1);
            postRepo.save(post);
            return false;
        } else {
            // Like
            PostLikeEntity like = new PostLikeEntity();
            like.setId(UUID.randomUUID());
            like.setPost(post);
            like.setUser(user);
            postLikeRepo.save(like);

            post.setLikesCount(post.getLikesCount() + 1);
            postRepo.save(post);
            return true;
        }
    }

    @Transactional
    public PostCommentEntity addComment(String postIdStr, String userIdStr, String content) {
        UUID postId = UUID.fromString(postIdStr);
        UUID userId = UUID.fromString(userIdStr);
        
        PostEntity post = postRepo.findById(postId)
            .orElseThrow(() -> new RuntimeException("Post not found"));

        UserEntity user = userRepo.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        PostCommentEntity comment = new PostCommentEntity();
        comment.setId(UUID.randomUUID());
        comment.setPost(post);
        comment.setUser(user);
        comment.setContent(content);

        PostCommentEntity saved = postCommentRepo.save(comment);

        post.setCommentsCount(post.getCommentsCount() + 1);
        postRepo.save(post);

        return saved;
    }

    public List<PostCommentEntity> getComments(String postIdStr) {
        UUID postId = UUID.fromString(postIdStr);
        return postCommentRepo.findByPost_IdOrderByCreatedAtDesc(postId);
    }

    public Page<PostCommentEntity> getCommentsPaginated(String postIdStr, int page, int size) {
        UUID postId = UUID.fromString(postIdStr);
        Pageable pageable = PageRequest.of(page, size);
        return postCommentRepo.findByPost_IdOrderByCreatedAtDesc(postId, pageable);
    }

    public boolean hasUserLiked(String postIdStr, String userIdStr) {
        UUID postId = UUID.fromString(postIdStr);
        UUID userId = UUID.fromString(userIdStr);
        return postLikeRepo.existsByPost_IdAndUser_Id(postId, userId);
    }

    @Transactional
    public void incrementView(String postIdStr) {
        UUID postId = UUID.fromString(postIdStr);
        PostEntity post = postRepo.findById(postId)
            .orElseThrow(() -> new RuntimeException("Post not found"));
        post.setViewsCount(post.getViewsCount() + 1);
        postRepo.save(post);
    }

    // Reaction methods
    @Transactional
    public void reactToPost(String postIdStr, String userIdStr, String reactionTypeStr) {
        UUID postId = UUID.fromString(postIdStr);
        UUID userId = UUID.fromString(userIdStr);
        
        PostEntity post = postRepo.findById(postId)
            .orElseThrow(() -> new RuntimeException("Post not found"));
        
        ReactionEntity.ReactionType reactionType;
        try {
            reactionType = ReactionEntity.ReactionType.valueOf(reactionTypeStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid reaction type");
        }

        // Check if user already reacted
        Optional<ReactionEntity> existing = reactionRepo.findByPostIdAndUserId(postId, userId);
        
        if (existing.isPresent()) {
            // Update existing reaction
            ReactionEntity reaction = existing.get();
            reaction.setReactionType(reactionType);
            reactionRepo.save(reaction);
        } else {
            // Create new reaction
            ReactionEntity reaction = new ReactionEntity();
            reaction.setPostId(postId);
            reaction.setUserId(userId);
            reaction.setReactionType(reactionType);
            reactionRepo.save(reaction);
        }
    }

    @Transactional
    public void removeReaction(String postIdStr, String userIdStr) {
        UUID postId = UUID.fromString(postIdStr);
        UUID userId = UUID.fromString(userIdStr);
        reactionRepo.deleteByPostIdAndUserId(postId, userId);
    }

    public Map<String, Long> getReactionCounts(String postIdStr) {
        UUID postId = UUID.fromString(postIdStr);
        List<Object[]> results = reactionRepo.countReactionsByType(postId);
        
        Map<String, Long> counts = new HashMap<>();
        for (Object[] row : results) {
            ReactionEntity.ReactionType type = (ReactionEntity.ReactionType) row[0];
            Long count = (Long) row[1];
            counts.put(type.name(), count);
        }
        return counts;
    }
}
