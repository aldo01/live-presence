package com.example.presence.feed;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface PostLikeRepository extends JpaRepository<PostLikeEntity, UUID> {

    // Check if user has liked a post
    boolean existsByPost_IdAndUser_Id(UUID postId, UUID userId);

    // Find like by post and user
    Optional<PostLikeEntity> findByPost_IdAndUser_Id(UUID postId, UUID userId);

    // Count likes for a post
    long countByPost_Id(UUID postId);

    // Delete like by post and user
    void deleteByPost_IdAndUser_Id(UUID postId, UUID userId);
}
