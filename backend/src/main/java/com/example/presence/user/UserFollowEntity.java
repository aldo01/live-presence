package com.example.presence.user;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_follows")
public class UserFollowEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @Column(name = "follower_id", nullable = false)
    private UUID followerId;
    
    @Column(name = "following_id", nullable = false)
    private UUID followingId;
    
    @Column(name = "created_at")
    private Instant createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }
    
    // Getters and Setters
    public UUID getId() {
        return id;
    }
    
    public void setId(UUID id) {
        this.id = id;
    }
    
    public UUID getFollowerId() {
        return followerId;
    }
    
    public void setFollowerId(UUID followerId) {
        this.followerId = followerId;
    }
    
    public UUID getFollowingId() {
        return followingId;
    }
    
    public void setFollowingId(UUID followingId) {
        this.followingId = followingId;
    }
    
    public Instant getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
