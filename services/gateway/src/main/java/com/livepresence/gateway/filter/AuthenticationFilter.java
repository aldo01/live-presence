package com.livepresence.gateway.filter;

import com.livepresence.gateway.util.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class AuthenticationFilter extends AbstractGatewayFilterFactory<AuthenticationFilter.Config> {

  private static final Logger log = LoggerFactory.getLogger(AuthenticationFilter.class);

  private final JwtUtil jwtUtil;

  public AuthenticationFilter(JwtUtil jwtUtil) {
    super(Config.class);
    this.jwtUtil = jwtUtil;
  }

  @Override
  public GatewayFilter apply(Config config) {
    return (exchange, chain) -> {
      ServerHttpRequest request = exchange.getRequest();
      
      if (!request.getHeaders().containsKey("Authorization")) {
        return onError(exchange, "Missing Authorization header", HttpStatus.UNAUTHORIZED);
      }

      String authHeader = request.getHeaders().getFirst("Authorization");
      if (authHeader == null || !authHeader.startsWith("Bearer ")) {
        return onError(exchange, "Invalid Authorization header format", HttpStatus.UNAUTHORIZED);
      }

      String token = authHeader.substring("Bearer ".length()).trim();
      
      try {
        if (!jwtUtil.validateToken(token)) {
          return onError(exchange, "Invalid or expired token", HttpStatus.UNAUTHORIZED);
        }

        // Extract user info and add to headers for downstream services
        String userId = jwtUtil.extractUserId(token);
        String email = jwtUtil.extractEmail(token);
        String name = jwtUtil.extractName(token);

        ServerHttpRequest modifiedRequest = exchange.getRequest().mutate()
            .header("X-User-Id", userId != null ? userId : "")
            .header("X-User-Email", email != null ? email : "")
            .header("X-User-Name", name != null ? name : "")
            .build();

        return chain.filter(exchange.mutate().request(modifiedRequest).build());
        
      } catch (Exception e) {
        log.warn("JWT authentication failed", e);
        return onError(exchange, "Token validation failed: " + e.getMessage(), HttpStatus.UNAUTHORIZED);
      }
    };
  }

  private Mono<Void> onError(ServerWebExchange exchange, String message, HttpStatus status) {
    exchange.getResponse().setStatusCode(status);
    exchange.getResponse().getHeaders().add("Content-Type", "application/json");
    
    String errorBody = String.format("{\"error\":\"%s\",\"message\":\"%s\"}", 
        status.getReasonPhrase(), message);
    
    return exchange.getResponse().writeWith(
        Mono.just(exchange.getResponse().bufferFactory().wrap(errorBody.getBytes()))
    );
  }

  public static class Config {
    // Configuration properties if needed
  }
}
