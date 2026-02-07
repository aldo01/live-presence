package com.livepresence.gateway.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class FallbackController {

  @GetMapping("/fallback")
  public ResponseEntity<Map<String, String>> fallback() {
    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(Map.of(
            "error", "Service Unavailable",
            "message", "The requested service is temporarily unavailable. Please try again later."
        ));
  }
}
