package com.example.presence.kafka.events;

import java.time.Instant;

/**
 * Post Event for Kafka messaging
 * Represents post lifecycle events: created, updated, deleted
 */
public class PostEvent {
    private String postId;
    private String userId;
    private String content;
    private String interest;
    private Double locationLat;
    private Double locationLon;
    private EventType eventType;
    private Instant timestamp;

    public enum EventType {
        CREATED,
        UPDATED,
        DELETED
    }

    // Default constructor for Jackson
    public PostEvent() {
        this.timestamp = Instant.now();
    }

    public PostEvent(String postId, String userId, String content, String interest, 
                     Double locationLat, Double locationLon, EventType eventType) {
        this.postId = postId;
        this.userId = userId;
        this.content = content;
        this.interest = interest;
        this.locationLat = locationLat;
        this.locationLon = locationLon;
        this.eventType = eventType;
        this.timestamp = Instant.now();
    }

    // Getters and Setters
    public String getPostId() {
        return postId;
    }

    public void setPostId(String postId) {
        this.postId = postId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getInterest() {
        return interest;
    }

    public void setInterest(String interest) {
        this.interest = interest;
    }

    public Double getLocationLat() {
        return locationLat;
    }

    public void setLocationLat(Double locationLat) {
        this.locationLat = locationLat;
    }

    public Double getLocationLon() {
        return locationLon;
    }

    public void setLocationLon(Double locationLon) {
        this.locationLon = locationLon;
    }

    public EventType getEventType() {
        return eventType;
    }

    public void setEventType(EventType eventType) {
        this.eventType = eventType;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    @Override
    public String toString() {
        return "PostEvent{" +
                "postId='" + postId + '\'' +
                ", userId='" + userId + '\'' +
                ", interest='" + interest + '\'' +
                ", eventType=" + eventType +
                ", timestamp=" + timestamp +
                '}';
    }
}
