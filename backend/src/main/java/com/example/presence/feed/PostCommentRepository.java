package com.example.presence.feed;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PostCommentRepository extends JpaRepository<PostCommentEntity, UUID> {

    // Find comments by post (paginated)
    Page<PostCommentEntity> findByPost_IdOrderByCreatedAtDesc(UUID postId, Pageable pageable);

    // Find comments by post (all)
    List<PostCommentEntity> findByPost_IdOrderByCreatedAtDesc(UUID postId);

    // Find top 3 recent comments
    List<PostCommentEntity> findTop3ByPost_IdOrderByCreatedAtDesc(UUID postId);

    // Count comments for a post
    long countByPost_Id(UUID postId);

    // Delete all comments for a post
    void deleteByPost_Id(UUID postId);
}
