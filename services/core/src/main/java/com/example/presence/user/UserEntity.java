package com.example.presence.user;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_users_email", columnList = "email", unique = true)
})
public class UserEntity {

  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(nullable = false, unique = true, columnDefinition = "citext")
  private String email;

  @Column(name = "password_hash", nullable = false)
  private String passwordHash;

  @Column(name = "display_name", nullable = false, length = 100)
  private String displayName;

  @Column(nullable = false, length = 120)
  private String interest = "General";

  @Column(nullable = false)
  private boolean live = true;

  @Column(name = "avatar_url", length = 500)
  private String avatarUrl;

  @Column(length = 500)
  private String bio;

  @Column(length = 20)
  private String gender;

  @Column(name = "profile_public", nullable = false)
  private boolean profilePublic = true;

  @Column(name = "last_location_lat")
  private Double lastLocationLat;

  @Column(name = "last_location_lon")
  private Double lastLocationLon;

  @Column(name = "followers_count")
  private Integer followersCount = 0;

  @Column(name = "following_count")
  private Integer followingCount = 0;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public UUID getId() { return id; }
  public String getEmail() { return email; }
  public String getPasswordHash() { return passwordHash; }
  public String getDisplayName() { return displayName; }
  public String getInterest() { return interest; }
  public boolean isLive() { return live; }
  public String getAvatarUrl() { return avatarUrl; }
  public String getBio() { return bio; }
  public String getGender() { return gender; }
  public boolean isProfilePublic() { return profilePublic; }
  public Double getLastLocationLat() { return lastLocationLat; }
  public Double getLastLocationLon() { return lastLocationLon; }
  public Integer getFollowersCount() { return followersCount; }
  public Integer getFollowingCount() { return followingCount; }
  public Instant getCreatedAt() { return createdAt; }

  public void setId(UUID id) { this.id = id; }
  public void setEmail(String email) { this.email = email; }
  public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
  public void setDisplayName(String displayName) { this.displayName = displayName; }
  public void setInterest(String interest) { this.interest = interest; }
  public void setLive(boolean live) { this.live = live; }
  public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
  public void setBio(String bio) { this.bio = bio; }
  public void setGender(String gender) { this.gender = gender; }
  public void setProfilePublic(boolean profilePublic) { this.profilePublic = profilePublic; }
  public void setLastLocationLat(Double lat) { this.lastLocationLat = lat; }
  public void setLastLocationLon(Double lon) { this.lastLocationLon = lon; }
  public void setFollowersCount(Integer followersCount) { this.followersCount = followersCount; }
  public void setFollowingCount(Integer followingCount) { this.followingCount = followingCount; }
}
