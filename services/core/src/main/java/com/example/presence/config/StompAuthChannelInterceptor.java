

package com.example.presence.config;

import com.example.presence.auth.JwtAuthFilter.JwtPrincipal;
import com.example.presence.auth.AccessTokenVerifier;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import org.springframework.messaging.*;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

  private final AccessTokenVerifier tokenVerifier;

  public StompAuthChannelInterceptor(AccessTokenVerifier tokenVerifier) {
    this.tokenVerifier = tokenVerifier;
  }

  @Override
  public Message<?> preSend(Message<?> message, MessageChannel channel) {
    StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
    if (accessor == null) return message;

    // Authenticate only at CONNECT time
    if (StompCommand.CONNECT.equals(accessor.getCommand())) {
      String authHeader = firstNativeHeader(accessor, "Authorization");
      if (authHeader == null || !authHeader.startsWith("Bearer ")) {
        throw new MessagingException("Missing Authorization header for WebSocket CONNECT");
      }

      String token = authHeader.substring("Bearer ".length()).trim();

      try {
        Jws<Claims> jws = tokenVerifier.parse(token);
        if (!tokenVerifier.isAccessToken(jws)) {
          throw new MessagingException("Invalid token type (expected access token)");
        }

        Claims c = jws.getPayload();
        String userId = c.getSubject();
        String email = c.get("email", String.class);
        String name = c.get("name", String.class);

        JwtPrincipal principal = new JwtPrincipal(userId, email, name);

        UsernamePasswordAuthenticationToken authentication =
            new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
            );

        accessor.setUser(authentication); // <-- critical: attaches user to the WS session
      } catch (Exception ex) {
        throw new MessagingException("WebSocket authentication failed: " + ex.getMessage());
      }
    }

    return message;
  }

  private String firstNativeHeader(StompHeaderAccessor accessor, String key) {
    List<String> values = accessor.getNativeHeader(key);
    return (values == null || values.isEmpty()) ? null : values.get(0);
  }
}
