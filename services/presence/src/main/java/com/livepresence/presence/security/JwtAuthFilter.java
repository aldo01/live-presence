package com.livepresence.presence.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.security.Principal;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

  private final AccessTokenVerifier tokenVerifier;

  public JwtAuthFilter(AccessTokenVerifier tokenVerifier) {
    this.tokenVerifier = tokenVerifier;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    String auth = request.getHeader("Authorization");
    if (auth == null || !auth.startsWith("Bearer ")) {
      filterChain.doFilter(request, response);
      return;
    }

    String token = auth.substring("Bearer ".length()).trim();
    try {
      Jws<Claims> jws = tokenVerifier.parse(token);
      if (!tokenVerifier.isAccessToken(jws)) {
        filterChain.doFilter(request, response);
        return;
      }

      Claims c = jws.getPayload();
      String userId = c.getSubject();
      String email = c.get("email", String.class);
      String name = c.get("name", String.class);

      var principal = new JwtPrincipal(userId, email, name);
      var authToken = new UsernamePasswordAuthenticationToken(
          principal, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))
      );
      SecurityContextHolder.getContext().setAuthentication(authToken);

    } catch (Exception ex) {
      SecurityContextHolder.clearContext();
    }

    filterChain.doFilter(request, response);
  }

  public record JwtPrincipal(String subject, String email, String name) implements Principal {
    @Override
    public String getName() {
      return subject;
    }
  }
}
