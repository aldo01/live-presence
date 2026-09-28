package com.livepresence.presence;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.livepresence.presence.security.JwtAuthFilter.JwtPrincipal;

/**
 * Presence is Redis-only and stateless. The client sends its identity snapshot
 * (displayName + interest) in the heartbeat, so this service never touches the
 * users database. When a client stops heartbeating (or sends isLive=false) the
 * Redis entry expires via TTL, so no cross-service call is needed to go offline.
 */
@RestController
@RequestMapping("/api/presence")
public class PresenceController {

  private final PresenceService presenceService;

  public PresenceController(PresenceService presenceService) {
    this.presenceService = presenceService;
  }

  public record HeartbeatRequest(double lat, double lon, String displayName, String interest, Boolean isLive) {}

  // Called every few seconds by mobile/web.
  @PostMapping("/heartbeat")
  public ResponseEntity<Void> heartbeat(@AuthenticationPrincipal JwtPrincipal p, @RequestBody HeartbeatRequest req) {
    // Respect "go offline"
    if (req.isLive() != null && !req.isLive()) {
      presenceService.markOffline(p.subject());
      return ResponseEntity.noContent().build();
    }

    // displayName falls back to the JWT name claim; interest to a sane default.
    String displayName = (req.displayName() != null && !req.displayName().isBlank())
        ? req.displayName().trim()
        : (p.name() != null ? p.name() : p.subject());
    String interest = (req.interest() != null && !req.interest().isBlank())
        ? req.interest().trim()
        : "General";

    presenceService.markAliveWithLocation(p.subject(), displayName, interest, req.lat(), req.lon());
    return ResponseEntity.noContent().build();
  }

  // Explicitly leave the map immediately (optional; TTL also handles this).
  @PostMapping("/offline")
  public ResponseEntity<Void> offline(@AuthenticationPrincipal JwtPrincipal p) {
    presenceService.markOffline(p.subject());
    return ResponseEntity.noContent().build();
  }

  // Find nearby live users within radiusKm (default 10km, max 20km).
  @GetMapping("/nearby")
  public List<LiveUserDTO> nearby(
      @AuthenticationPrincipal JwtPrincipal p,
      @RequestParam double lat,
      @RequestParam double lon,
      @RequestParam(defaultValue = "10") double radiusKm,
      @RequestParam(defaultValue = "50") int limit,
      @RequestParam(required = false) String interest
  ) {
    if (radiusKm > 20) {
      radiusKm = 20;
    }

    List<LiveUserDTO> list = presenceService.findNearby(lat, lon, radiusKm, limit);

    // exclude self
    list = list.stream().filter(x -> !x.userId().equals(p.subject())).toList();

    // optional interest filter
    if (interest != null && !interest.isBlank()) {
      String want = interest.trim();
      list = list.stream().filter(x -> want.equalsIgnoreCase(x.interest())).toList();
    }

    return list;
  }
}
