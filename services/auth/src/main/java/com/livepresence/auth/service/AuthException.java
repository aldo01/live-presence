package com.livepresence.auth.service;

import org.springframework.http.HttpStatus;

public class AuthException extends RuntimeException {

  private final HttpStatus status;

  public AuthException(HttpStatus status, String message) {
    super(message);
    this.status = status;
  }

  public HttpStatus getStatus() {
    return status;
  }

  public static AuthException emailTaken() {
    return new AuthException(HttpStatus.CONFLICT, "email already registered");
  }

  public static AuthException badCredentials() {
    return new AuthException(HttpStatus.UNAUTHORIZED, "invalid credentials");
  }

  public static AuthException invalidRefreshToken() {
    return new AuthException(HttpStatus.UNAUTHORIZED, "invalid or expired refresh token");
  }
}
