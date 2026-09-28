package com.livepresence.gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

/**
 * The gateway pulls in spring-boot-starter-security, whose WebFlux defaults would
 * secure every exchange (401) and demand a CSRF token on writes (403). Route-level
 * authentication is instead performed by the custom {@code AuthenticationFilter},
 * so here we disable the framework defaults and let all exchanges through — the
 * per-route filters decide what actually needs a valid JWT.
 */
@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

  @Bean
  public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
    return http
        .csrf(ServerHttpSecurity.CsrfSpec::disable)
        .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
        .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
        .logout(ServerHttpSecurity.LogoutSpec::disable)
        .authorizeExchange(ex -> ex.anyExchange().permitAll())
        .build();
  }
}
