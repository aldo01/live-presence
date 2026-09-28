package com.livepresence.auth.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Only relevant when the service is hit directly (e.g. port-forwarded during
 * debugging). In the normal topology the gateway owns CORS.
 */
@Configuration
public class CorsConfig {

  @Bean
  public UrlBasedCorsConfigurationSource corsConfigurationSource(
      @Value("${app.cors.allowed-origins:http://localhost:3000,http://localhost:5173}") String origins
  ) {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOriginPatterns(List.of(origins.split(",")));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(true);
    config.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
  }
}
