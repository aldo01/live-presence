package com.livepresence.auth.api;

import com.livepresence.auth.api.AuthDtos.ErrorResponse;
import com.livepresence.auth.service.AuthException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice
public class AuthExceptionHandler {

  @ExceptionHandler(AuthException.class)
  public ResponseEntity<ErrorResponse> handleAuth(AuthException ex) {
    return ResponseEntity.status(ex.getStatus())
        .body(new ErrorResponse(ex.getStatus().getReasonPhrase(), ex.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
    String detail = ex.getBindingResult().getFieldErrors().stream()
        .map(e -> e.getField() + " " + e.getDefaultMessage())
        .collect(Collectors.joining("; "));
    return ResponseEntity.badRequest()
        .body(new ErrorResponse("Bad Request", detail.isBlank() ? "invalid input" : detail));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
    return ResponseEntity.badRequest().body(new ErrorResponse("Bad Request", ex.getMessage()));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(new ErrorResponse("Internal Server Error", "unexpected error"));
  }
}
