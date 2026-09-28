package com.example.presence.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

/**
 * Verifies access tokens minted by the auth service. It deliberately cannot issue
 * anything — the core service has no path to hand out credentials.
 *
 * The gateway already rejects unauthenticated traffic, but core re-verifies rather
 * than trusting X-User-Id headers, so a request that reaches the pod by some other
 * route (port-forward, another service, a misconfigured mesh) is still checked.
 */
@Service
public class AccessTokenVerifier {

  private final SecretKey key;

  public AccessTokenVerifier(@Value("${app.jwt.secret}") String secret) {
    if (secret == null || secret.length() < 32) {
      throw new IllegalArgumentException("app.jwt.secret must be at least 32 chars (use 64+).");
    }
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
  }

  /** @throws io.jsonwebtoken.JwtException if the signature or expiry is bad. */
  public Jws<Claims> parse(String token) {
    return Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
  }

  public boolean isAccessToken(Jws<Claims> jws) {
    return "access".equals(jws.getPayload().get("typ", String.class));
  }
}
