package com.example.presence.auth.dto;

public class AuthDtos {

  public record RegisterRequest(String email, String password, String displayName) {}
  public record LoginRequest(String email, String password) {}
  public record RefreshRequest(String refreshToken) {}

  public record AuthResponse(
      String accessToken,
      String refreshToken,
      String userId,
      String email,
      String displayName
  ) {}
}
