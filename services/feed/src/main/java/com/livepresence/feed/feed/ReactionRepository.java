package com.livepresence.feed.feed;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReactionRepository extends JpaRepository<ReactionEntity, UUID> {
    
    Optional<ReactionEntity> findByPostIdAndUserId(UUID postId, UUID userId);
    
    void deleteByPostIdAndUserId(UUID postId, UUID userId);
    
    @Query("SELECT r.reactionType, COUNT(r) FROM ReactionEntity r WHERE r.postId = :postId GROUP BY r.reactionType")
    List<Object[]> countReactionsByType(UUID postId);
    
    @Query("SELECT r.postId, r.reactionType, COUNT(r) FROM ReactionEntity r WHERE r.postId IN :postIds GROUP BY r.postId, r.reactionType")
    List<Object[]> countReactionsByTypeForPosts(List<UUID> postIds);
}
