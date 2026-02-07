package com.example.presence.presence;

import com.example.presence.auth.JwtAuthFilter.JwtPrincipal;
import com.example.presence.presence.dto.LiveUserDTO;
import com.example.presence.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/presence")
public class PresenceController {

  private final PresenceService presenceService;
  private final UserRepository userRepo;

  public PresenceController(PresenceService presenceService, UserRepository userRepo) {
    this.presenceService = presenceService;
    this.userRepo = userRepo;
  }

  public record HeartbeatRequest(double lat, double lon, Boolean isLive) {}

  // Called every 5 seconds by mobile/web
  @PostMapping("/heartbeat")
  public ResponseEntity<Void> heartbeat(@AuthenticationPrincipal JwtPrincipal p, @RequestBody HeartbeatRequest req) {
    UUID userId = UUID.fromString(p.subject());
    var u = userRepo.findById(userId).orElseThrow();

    // Update user's last location
    u.setLastLocationLat(req.lat());
    u.setLastLocationLon(req.lon());

    // Update live status if provided
    if (req.isLive() != null) {
      u.setLive(req.isLive());
    }

    userRepo.save(u);

    // Respect "go offline"
    if (!u.isLive()) {
      presenceService.markOffline(u.getId().toString());
      return ResponseEntity.noContent().build();
    }

    presenceService.markAliveWithLocation(
        u.getId().toString(),
        u.getDisplayName(),
        u.getInterest(),
        req.lat(),
        req.lon()
    );

    return ResponseEntity.noContent().build();
  }

  // Find nearby live users within radiusKm (default 10km, max 20km)
  @GetMapping("/nearby")
  public List<LiveUserDTO> nearby(
      @AuthenticationPrincipal JwtPrincipal p,
      @RequestParam double lat,
      @RequestParam double lon,
      @RequestParam(defaultValue = "10") double radiusKm,
      @RequestParam(defaultValue = "50") int limit,
      @RequestParam(required = false) String interest
  ) {
    // Max radius 20km
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

  // Toggle live status
  @PutMapping("/live")
  public ResponseEntity<?> setLive(@AuthenticationPrincipal JwtPrincipal p, @RequestBody SetLiveRequest req) {
    UUID userId = UUID.fromString(p.subject());
    var u = userRepo.findById(userId).orElseThrow();
    u.setLive(req.live());
    userRepo.save(u);

    if (!req.live()) {
      presenceService.markOffline(u.getId().toString());
    }

    return ResponseEntity.ok(Map.of("live", req.live()));
  }

  public record SetLiveRequest(boolean live) {}
}
