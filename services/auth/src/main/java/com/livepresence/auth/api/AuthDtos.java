package com.livepresence.auth.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

  private AuthDtos() {}

  public record RegisterRequest(
      @NotBlank @Email String email,
      @NotBlank @Size(min = 6, max = 100) String password,
      @NotBlank @Size(max = 100) String displayName
  ) {}

  public record LoginRequest(
      @NotBlank String email,
      @NotBlank String password
  ) {}

  public record RefreshRequest(@NotBlank String refreshToken) {}

  public record LogoutRequest(String refreshToken) {}

  /**
   * Shape is unchanged from the monolith so existing clients keep working;
   * {@code expiresIn} is added for the iOS client's proactive refresh.
   */
  public record AuthResponse(
      String accessToken,
      String refreshToken,
      String userId,
      String email,
      String displayName,
      long expiresIn
  ) {}

  public record ErrorResponse(String error, String message) {}
}
