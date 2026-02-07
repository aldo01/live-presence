package com.example.presence.auth;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService {

  private final Key key;
  private final long accessMinutes;
  private final long refreshDays;

  public JwtService(
      @Value("${app.jwt.secret}") String secret,
      @Value("${app.jwt.accessMinutes}") long accessMinutes,
      @Value("${app.jwt.refreshDays}") long refreshDays
  ) {
    if (secret == null || secret.length() < 32) {
      throw new IllegalArgumentException("JWT secret must be at least 32 chars (use 64+).");
    }
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    this.accessMinutes = accessMinutes;
    this.refreshDays = refreshDays;
  }

  public String createAccessToken(String userId, String email, String displayName) {
    Instant now = Instant.now();
    Instant exp = now.plus(accessMinutes, ChronoUnit.MINUTES);

    return Jwts.builder()
        .subject(userId)
        .claims(Map.of("email", email, "name", displayName, "typ", "access"))
        .issuedAt(Date.from(now))
        .expiration(Date.from(exp))
        .signWith(key)
        .compact();
  }

  public String createRefreshToken(String userId) {
    Instant now = Instant.now();
    Instant exp = now.plus(refreshDays, ChronoUnit.DAYS);

    return Jwts.builder()
        .subject(userId)
        .claims(Map.of("typ", "refresh"))
        .issuedAt(Date.from(now))
        .expiration(Date.from(exp))
        .signWith(key)
        .compact();
  }

  public Jws<Claims> parse(String token) {
    return Jwts.parser()
        .verifyWith((javax.crypto.SecretKey) key)
        .build()
        .parseSignedClaims(token);
  }

  public boolean isRefreshToken(Jws<Claims> jws) {
    return "refresh".equals(jws.getPayload().get("typ", String.class));
  }

  public boolean isAccessToken(Jws<Claims> jws) {
    return "access".equals(jws.getPayload().get("typ", String.class));
  }
}
