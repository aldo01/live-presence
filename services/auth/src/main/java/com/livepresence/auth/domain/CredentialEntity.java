package com.livepresence.auth.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * The auth service's slice of a user: identity + credentials only.
 *
 * Everything else about a person (display name beyond the initial value, avatar,
 * interest, location, follower counts) belongs to the core service's
 * {@code core.user_profiles} table. There is deliberately no foreign key between
 * the two schemas.
 */
@Entity
@Table(name = "users", schema = "auth")
public class CredentialEntity {

  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(nullable = false, unique = true, columnDefinition = "citext")
  private String email;

  @Column(name = "password_hash", nullable = false)
  private String passwordHash;

  /** Kept here only so registration can seed the profile and stamp the JWT. */
  @Column(name = "display_name", nullable = false, length = 100)
  private String displayName;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt = Instant.now();

  public UUID getId() { return id; }
  public String getEmail() { return email; }
  public String getPasswordHash() { return passwordHash; }
  public String getDisplayName() { return displayName; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }

  public void setId(UUID id) { this.id = id; }
  public void setEmail(String email) { this.email = email; }
  public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
  public void setDisplayName(String displayName) { this.displayName = displayName; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
  public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
