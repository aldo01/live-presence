package com.example.presence.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.messaging.simp.config.ChannelRegistration;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

  // Chat photos were historically sent inline as base64 over STOMP; media now
  // uploads to object storage and only a key travels over the socket, but we
  // keep a generous limit for safety. Spring's default is 64 KB.
  private static final int MAX_MESSAGE_SIZE = 5 * 1024 * 1024; // 5 MB

  private final StompAuthChannelInterceptor stompAuthChannelInterceptor;

  // When enabled, STOMP fan-out goes through an external broker (RabbitMQ STOMP)
  // so multiple core instances share one message bus — a message sent on node A
  // reaches a subscriber connected to node B. The in-memory SimpleBroker only
  // works on a single node and is the fallback for lightweight local runs.
  @Value("${app.stomp.relay.enabled:false}")
  private boolean relayEnabled;
  @Value("${app.stomp.relay.host:localhost}")
  private String relayHost;
  @Value("${app.stomp.relay.port:61613}")
  private int relayPort;
  @Value("${app.stomp.relay.login:guest}")
  private String relayLogin;
  @Value("${app.stomp.relay.passcode:guest}")
  private String relayPasscode;

  public WebSocketConfig(StompAuthChannelInterceptor stompAuthChannelInterceptor) {
    this.stompAuthChannelInterceptor = stompAuthChannelInterceptor;
  }

  @Override
  public void configureMessageBroker(MessageBrokerRegistry config) {
    if (relayEnabled) {
      config.enableStompBrokerRelay("/topic", "/queue")
          .setRelayHost(relayHost)
          .setRelayPort(relayPort)
          .setClientLogin(relayLogin)
          .setClientPasscode(relayPasscode)
          .setSystemLogin(relayLogin)
          .setSystemPasscode(relayPasscode);
    } else {
      config.enableSimpleBroker("/topic", "/queue");
    }
    config.setApplicationDestinationPrefixes("/app");
    config.setUserDestinationPrefix("/user");
  }

  @Override
  public void registerStompEndpoints(StompEndpointRegistry registry) {
    registry.addEndpoint("/ws")
        .setAllowedOriginPatterns("*")
        .withSockJS();
  }

  @Override
  public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
    registration.setMessageSizeLimit(MAX_MESSAGE_SIZE);      // max inbound STOMP message
    registration.setSendBufferSizeLimit(MAX_MESSAGE_SIZE);   // per-session outbound buffer
    registration.setSendTimeLimit(20 * 1000);                // ms to flush a slow client
  }

  @Override
  public void configureClientInboundChannel(ChannelRegistration registration) {
    registration.interceptors(stompAuthChannelInterceptor);
  }
}
