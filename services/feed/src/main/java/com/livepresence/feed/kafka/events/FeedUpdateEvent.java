package com.livepresence.feed.kafka.events;

import java.time.Instant;

/**
 * Feed Update Event for notifying users of new posts in their feed
 */
public class FeedUpdateEvent {
    private String userId;
    private String postId;
    private String postAuthorId;
    private String interest;
    private UpdateReason reason;
    private Instant timestamp;

    public enum UpdateReason {
        NEW_POST,           // New post from followed user
        NEARBY_POST,        // New post from user in proximity
        TRENDING_POST       // Trending post in user's interest
    }

    public FeedUpdateEvent() {
        this.timestamp = Instant.now();
    }

    public FeedUpdateEvent(String userId, String postId, String postAuthorId, 
                           String interest, UpdateReason reason) {
        this.userId = userId;
        this.postId = postId;
        this.postAuthorId = postAuthorId;
        this.interest = interest;
        this.reason = reason;
        this.timestamp = Instant.now();
    }

    // Getters and Setters
    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getPostId() {
        return postId;
    }

    public void setPostId(String postId) {
        this.postId = postId;
    }

    public String getPostAuthorId() {
        return postAuthorId;
    }

    public void setPostAuthorId(String postAuthorId) {
        this.postAuthorId = postAuthorId;
    }

    public String getInterest() {
        return interest;
    }

    public void setInterest(String interest) {
        this.interest = interest;
    }

    public UpdateReason getReason() {
        return reason;
    }

    public void setReason(UpdateReason reason) {
        this.reason = reason;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    @Override
    public String toString() {
        return "FeedUpdateEvent{" +
                "userId='" + userId + '\'' +
                ", postId='" + postId + '\'' +
                ", reason=" + reason +
                ", timestamp=" + timestamp +
                '}';
    }
}
