package com.example.presence.auth;

import com.example.presence.auth.dto.AuthDtos.*;
import com.example.presence.user.UserEntity;
import com.example.presence.user.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final UserRepository userRepo;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;

  public AuthController(UserRepository userRepo, PasswordEncoder passwordEncoder, JwtService jwtService) {
    this.userRepo = userRepo;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
  }

  @PostMapping("/register")
  public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
    if (req.email() == null || req.password() == null || req.displayName() == null) {
      return ResponseEntity.badRequest().body("email/password/displayName required");
    }
    String email = req.email().trim().toLowerCase(Locale.ROOT);
    if (email.isBlank() || req.password().length() < 6 || req.displayName().trim().isBlank()) {
      return ResponseEntity.badRequest().body("invalid input");
    }
    if (userRepo.existsByEmailIgnoreCase(email)) {
      return ResponseEntity.status(409).body("email already registered");
    }

    UserEntity u = new UserEntity();
    u.setId(UUID.randomUUID());  // Set UUID directly
    u.setEmail(email);
    u.setDisplayName(req.displayName().trim());
    u.setInterest("General");
    u.setPasswordHash(passwordEncoder.encode(req.password()));
    u = userRepo.save(u);

    String access = jwtService.createAccessToken(u.getId().toString(), u.getEmail(), u.getDisplayName());
    String refresh = jwtService.createRefreshToken(u.getId().toString());
    return ResponseEntity.ok(new AuthResponse(access, refresh, u.getId().toString(), u.getEmail(), u.getDisplayName()));
  }

  @PostMapping("/login")
  public ResponseEntity<?> login(@RequestBody LoginRequest req) {
    if (req.email() == null || req.password() == null) {
      return ResponseEntity.badRequest().body("email/password required");
    }
    String email = req.email().trim().toLowerCase(Locale.ROOT);

    var userOpt = userRepo.findByEmailIgnoreCase(email);
    if (userOpt.isEmpty()) {
      return ResponseEntity.status(401).body("invalid credentials");
    }
    UserEntity u = userOpt.get();
    if (!passwordEncoder.matches(req.password(), u.getPasswordHash())) {
      return ResponseEntity.status(401).body("invalid credentials");
    }

    String access = jwtService.createAccessToken(u.getId().toString(), u.getEmail(), u.getDisplayName());
    String refresh = jwtService.createRefreshToken(u.getId().toString());
    return ResponseEntity.ok(new AuthResponse(access, refresh, u.getId().toString(), u.getEmail(), u.getDisplayName()));
  }

  @PostMapping("/refresh")
  public ResponseEntity<?> refresh(@RequestBody RefreshRequest req) {
    if (req.refreshToken() == null || req.refreshToken().isBlank()) {
      return ResponseEntity.badRequest().body("refreshToken required");
    }
    try {
      Jws<Claims> jws = jwtService.parse(req.refreshToken().trim());
      if (!jwtService.isRefreshToken(jws)) {
        return ResponseEntity.status(401).body("invalid refresh token");
      }
      String userId = jws.getPayload().getSubject();
      UUID userUuid = UUID.fromString(userId);
      var userOpt = userRepo.findById(userUuid);
      if (userOpt.isEmpty()) return ResponseEntity.status(401).body("user not found");

      UserEntity u = userOpt.get();
      String newAccess = jwtService.createAccessToken(u.getId().toString(), u.getEmail(), u.getDisplayName());
      // optional: rotate refresh token (recommended)
      String newRefresh = jwtService.createRefreshToken(u.getId().toString());

      return ResponseEntity.ok(new AuthResponse(newAccess, newRefresh, u.getId().toString(), u.getEmail(), u.getDisplayName()));
    } catch (Exception ex) {
      return ResponseEntity.status(401).body("invalid/expired refresh token");
    }
  }
}
