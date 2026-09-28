package com.livepresence.auth.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * A persisted, rotatable refresh token. Only the SHA-256 hash of the token is
 * stored, so a database leak does not hand out usable sessions.
 */
@Entity
@Table(name = "refresh_tokens", schema = "auth")
public class RefreshTokenEntity {

  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
  private UUID userId;

  @Column(name = "token_hash", nullable = false, unique = true)
  private String tokenHash;

  @Column(name = "issued_at", nullable = false)
  private Instant issuedAt = Instant.now();

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Column(name = "revoked_at")
  private Instant revokedAt;

  /** Set when this token was rotated, pointing at its successor. */
  @Column(name = "replaced_by", columnDefinition = "uuid")
  private UUID replacedBy;

  public boolean isActive(Instant now) {
    return revokedAt == null && expiresAt.isAfter(now);
  }

  public UUID getId() { return id; }
  public UUID getUserId() { return userId; }
  public String getTokenHash() { return tokenHash; }
  public Instant getIssuedAt() { return issuedAt; }
  public Instant getExpiresAt() { return expiresAt; }
  public Instant getRevokedAt() { return revokedAt; }
  public UUID getReplacedBy() { return replacedBy; }

  public void setId(UUID id) { this.id = id; }
  public void setUserId(UUID userId) { this.userId = userId; }
  public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
  public void setIssuedAt(Instant issuedAt) { this.issuedAt = issuedAt; }
  public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
  public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }
  public void setReplacedBy(UUID replacedBy) { this.replacedBy = replacedBy; }
}
