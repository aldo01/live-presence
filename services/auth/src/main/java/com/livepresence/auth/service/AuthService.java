package com.livepresence.auth.service;

import com.livepresence.auth.api.AuthDtos.AuthResponse;
import com.livepresence.auth.domain.CredentialEntity;
import com.livepresence.auth.domain.CredentialRepository;
import com.livepresence.auth.domain.RefreshTokenEntity;
import com.livepresence.auth.domain.RefreshTokenRepository;
import com.livepresence.auth.event.UserEventPublisher;
import com.livepresence.auth.token.TokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

  private static final Logger log = LoggerFactory.getLogger(AuthService.class);

  private final CredentialRepository credentials;
  private final RefreshTokenRepository refreshTokens;
  private final PasswordEncoder passwordEncoder;
  private final TokenService tokens;
  private final UserEventPublisher events;

  public AuthService(
      CredentialRepository credentials,
      RefreshTokenRepository refreshTokens,
      PasswordEncoder passwordEncoder,
      TokenService tokens,
      UserEventPublisher events
  ) {
    this.credentials = credentials;
    this.refreshTokens = refreshTokens;
    this.passwordEncoder = passwordEncoder;
    this.tokens = tokens;
    this.events = events;
  }

  @Transactional
  public AuthResponse register(String rawEmail, String password, String rawDisplayName) {
    String email = normalize(rawEmail);
    String displayName = rawDisplayName.trim();

    if (credentials.existsByEmailIgnoreCase(email)) {
      throw AuthException.emailTaken();
    }

    CredentialEntity user = new CredentialEntity();
    user.setId(UUID.randomUUID());
    user.setEmail(email);
    user.setDisplayName(displayName);
    user.setPasswordHash(passwordEncoder.encode(password));
    user = credentials.save(user);

    // Core provisions its own profile row lazily from the JWT on first authenticated
    // request, so this event is an optimisation (pre-warm), not a correctness
    // requirement. That keeps registration working with Kafka switched off.
    events.publishUserRegistered(user.getId(), user.getEmail(), user.getDisplayName());

    log.info("registered user {}", user.getId());
    return issue(user);
  }

  @Transactional
  public AuthResponse login(String rawEmail, String password) {
    String email = normalize(rawEmail);
    CredentialEntity user = credentials.findByEmailIgnoreCase(email)
        .orElseThrow(AuthException::badCredentials);

    if (!passwordEncoder.matches(password, user.getPasswordHash())) {
      throw AuthException.badCredentials();
    }
    return issue(user);
  }

  /**
   * Rotating refresh. The presented token is revoked and replaced. If a token that
   * was already rotated away is presented again, we treat it as theft and revoke
   * every session for that user.
   */
  @Transactional
  public AuthResponse refresh(String rawRefreshToken) {
    String tokenHash = tokens.hash(rawRefreshToken.trim());
    RefreshTokenEntity stored = refreshTokens.findByTokenHash(tokenHash)
        .orElseThrow(AuthException::invalidRefreshToken);

    Instant now = Instant.now();
    if (!stored.isActive(now)) {
      if (stored.getRevokedAt() != null) {
        log.warn("refresh token reuse detected for user {} — revoking all sessions", stored.getUserId());
        refreshTokens.revokeAllForUser(stored.getUserId(), now);
      }
      throw AuthException.invalidRefreshToken();
    }

    CredentialEntity user = credentials.findById(stored.getUserId())
        .orElseThrow(AuthException::invalidRefreshToken);

    Issued issued = issueTokens(user);
    stored.setRevokedAt(now);
    stored.setReplacedBy(issued.refreshToken().getId());
    refreshTokens.save(stored);

    return issued.response();
  }

  @Transactional
  public void logout(String rawRefreshToken) {
    if (rawRefreshToken == null || rawRefreshToken.isBlank()) return;
    refreshTokens.findByTokenHash(tokens.hash(rawRefreshToken.trim()))
        .ifPresent(t -> {
          t.setRevokedAt(Instant.now());
          refreshTokens.save(t);
        });
  }

  @Transactional
  public void logoutEverywhere(UUID userId) {
    refreshTokens.revokeAllForUser(userId, Instant.now());
  }

  private record Issued(AuthResponse response, RefreshTokenEntity refreshToken) {}

  private AuthResponse issue(CredentialEntity user) {
    return issueTokens(user).response();
  }

  private Issued issueTokens(CredentialEntity user) {
    String access = tokens.createAccessToken(
        user.getId().toString(), user.getEmail(), user.getDisplayName());
    String refresh = tokens.createRefreshToken();

    RefreshTokenEntity entity = new RefreshTokenEntity();
    entity.setId(UUID.randomUUID());
    entity.setUserId(user.getId());
    entity.setTokenHash(tokens.hash(refresh));
    entity.setIssuedAt(Instant.now());
    entity.setExpiresAt(tokens.refreshExpiry());
    entity = refreshTokens.save(entity);

    AuthResponse response = new AuthResponse(
        access,
        refresh,
        user.getId().toString(),
        user.getEmail(),
        user.getDisplayName(),
        tokens.accessTokenTtlSeconds()
    );
    return new Issued(response, entity);
  }

  private static String normalize(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }
}
