package com.livepresence.auth.api;

import com.livepresence.auth.api.AuthDtos.*;
import com.livepresence.auth.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Public surface of the auth service. Reachable through the gateway at
 * {@code /api/auth/**}; the gateway deliberately does NOT apply its
 * AuthenticationFilter here, since these are the endpoints that hand out tokens.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final AuthService authService;

  public AuthController(AuthService authService) {
    this.authService = authService;
  }

  @PostMapping("/register")
  public AuthResponse register(@Valid @RequestBody RegisterRequest req) {
    return authService.register(req.email(), req.password(), req.displayName());
  }

  @PostMapping("/login")
  public AuthResponse login(@Valid @RequestBody LoginRequest req) {
    return authService.login(req.email(), req.password());
  }

  @PostMapping("/refresh")
  public AuthResponse refresh(@Valid @RequestBody RefreshRequest req) {
    return authService.refresh(req.refreshToken());
  }

  @PostMapping("/logout")
  public ResponseEntity<Map<String, Object>> logout(@RequestBody(required = false) LogoutRequest req) {
    authService.logout(req == null ? null : req.refreshToken());
    return ResponseEntity.ok(Map.of("success", true));
  }

  /**
   * Revokes every refresh token for the caller. The gateway validates the access
   * token and forwards the id as X-User-Id.
   */
  @PostMapping("/logout-all")
  public ResponseEntity<Map<String, Object>> logoutAll(@RequestHeader("X-User-Id") String userId) {
    authService.logoutEverywhere(UUID.fromString(userId));
    return ResponseEntity.ok(Map.of("success", true));
  }
}
