package com.livepresence.gateway.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

@Component
public class JwtUtil {

  private final SecretKey key;

  public JwtUtil(@Value("${jwt.secret}") String secret) {
    if (secret == null || secret.length() < 32) {
      throw new IllegalArgumentException("JWT secret must be at least 32 characters");
    }
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
  }

  public boolean validateToken(String token) {
    try {
      Jws<Claims> jws = Jwts.parser()
          .verifyWith(key)
          .build()
          .parseSignedClaims(token);
      
      // Check if it's an access token
      String tokenType = jws.getPayload().get("typ", String.class);
      return "access".equals(tokenType);
      
    } catch (Exception e) {
      return false;
    }
  }

  public String extractUserId(String token) {
    return extractClaims(token).getSubject();
  }

  public String extractEmail(String token) {
    return extractClaims(token).get("email", String.class);
  }

  public String extractName(String token) {
    return extractClaims(token).get("name", String.class);
  }

  private Claims extractClaims(String token) {
    return Jwts.parser()
        .verifyWith(key)
        .build()
        .parseSignedClaims(token)
        .getPayload();
  }
}
