package com.example.presence.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserFollowRepository extends JpaRepository<UserFollowEntity, UUID> {
    
    // Check if user A follows user B
    Optional<UserFollowEntity> findByFollowerIdAndFollowingId(UUID followerId, UUID followingId);
    
    // Get all users that a user is following
    @Query("SELECT uf.followingId FROM UserFollowEntity uf WHERE uf.followerId = :userId")
    List<UUID> findFollowingIds(@Param("userId") UUID userId);
    
    // Get all users that follow a user
    @Query("SELECT uf.followerId FROM UserFollowEntity uf WHERE uf.followingId = :userId")
    List<UUID> findFollowerIds(@Param("userId") UUID userId);
    
    // Get all users that follow a user (by followed_id)
    @Query("SELECT uf.followerId FROM UserFollowEntity uf WHERE uf.followingId = :followedId")
    List<UUID> findFollowerIdsByFollowedId(@Param("followedId") UUID followedId);
    
    // Count followers
    long countByFollowingId(UUID followingId);
    
    // Count following
    long countByFollowerId(UUID followerId);
    
    // Delete follow relationship
    void deleteByFollowerIdAndFollowingId(UUID followerId, UUID followingId);
}
