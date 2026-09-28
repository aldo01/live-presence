package com.livepresence.gateway.filter;

import com.livepresence.gateway.util.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpRequestDecorator;
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

        // Extract user info and forward it to downstream services. The request
        // headers can be read-only here (the Retry filter caches them), so we
        // copy them into a writable set exposed via a request decorator instead
        // of calling the builder's header() method, which would throw.
        String userId = jwtUtil.extractUserId(token);
        String email = jwtUtil.extractEmail(token);
        String name = jwtUtil.extractName(token);

        HttpHeaders writable = new HttpHeaders();
        writable.putAll(request.getHeaders());
        writable.set("X-User-Id", userId != null ? userId : "");
        writable.set("X-User-Email", email != null ? email : "");
        writable.set("X-User-Name", name != null ? name : "");

        ServerHttpRequest modifiedRequest = new ServerHttpRequestDecorator(request) {
          @Override
          public HttpHeaders getHeaders() {
            return writable;
          }
        };

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
