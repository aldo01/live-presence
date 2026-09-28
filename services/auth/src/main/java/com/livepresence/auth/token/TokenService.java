package com.livepresence.auth.token;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;
import java.util.Map;

/**
 * The only component in the system that MINTS tokens. The gateway and the core
 * service verify them with the same shared secret but never issue.
 *
 * Access tokens are self-contained JWTs (claims: sub, email, name, typ=access).
 * Refresh tokens are opaque random strings — they carry no claims and are only
 * meaningful against the auth.refresh_tokens table, which makes revocation real.
 */
@Service
public class TokenService {

  private final SecretKey key;
  private final long accessMinutes;
  private final long refreshDays;
  private final SecureRandom random = new SecureRandom();

  public TokenService(
      @Value("${app.jwt.secret}") String secret,
      @Value("${app.jwt.accessMinutes}") long accessMinutes,
      @Value("${app.jwt.refreshDays}") long refreshDays
  ) {
    if (secret == null || secret.length() < 32) {
      throw new IllegalArgumentException("app.jwt.secret must be at least 32 chars (use 64+).");
    }
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    this.accessMinutes = accessMinutes;
    this.refreshDays = refreshDays;
  }

  public String createAccessToken(String userId, String email, String displayName) {
    Instant now = Instant.now();
    return Jwts.builder()
        .subject(userId)
        .claims(Map.of("email", email, "name", displayName, "typ", "access"))
        .issuedAt(Date.from(now))
        .expiration(Date.from(now.plus(accessMinutes, ChronoUnit.MINUTES)))
        .signWith(key)
        .compact();
  }

  /** Opaque, high-entropy refresh token. The caller persists only {@link #hash}. */
  public String createRefreshToken() {
    byte[] buf = new byte[48];
    random.nextBytes(buf);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
  }

  public Instant refreshExpiry() {
    return Instant.now().plus(refreshDays, ChronoUnit.DAYS);
  }

  public long accessTokenTtlSeconds() {
    return accessMinutes * 60;
  }

  public String hash(String rawToken) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return Base64.getEncoder().encodeToString(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 unavailable", e);
    }
  }

  public Jws<Claims> parseAccessToken(String token) {
    return Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
  }
}
