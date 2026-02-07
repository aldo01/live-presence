package com.example.presence.presence;

import com.example.presence.presence.dto.LiveUserDTO;
import org.springframework.data.geo.*;
import org.springframework.data.redis.core.*;
import org.springframework.data.redis.connection.RedisGeoCommands;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
public class PresenceService {

  private static final String GEO_KEY = "presence:geo";
  private static final String META_KEY_PREFIX = "presence:meta:"; // + userId
  private static final long TTL_SECONDS = 30; // if heartbeat stops, user disappears

  private final StringRedisTemplate redis;

  public PresenceService(StringRedisTemplate redis) {
    this.redis = redis;
  }

  public void markAliveWithLocation(String userId, String displayName, String interest, double lat, double lon) {
    // Redis GEOADD expects (lon, lat)
    redis.opsForGeo().add(GEO_KEY, new Point(lon, lat), userId);

    String metaKey = META_KEY_PREFIX + userId;
    redis.opsForHash().put(metaKey, "displayName", displayName);
    redis.opsForHash().put(metaKey, "interest", interest);
    redis.opsForHash().put(metaKey, "lat", String.valueOf(lat));
    redis.opsForHash().put(metaKey, "lon", String.valueOf(lon));
    redis.opsForHash().put(metaKey, "lastSeen", Instant.now().toString());

    redis.expire(metaKey, TTL_SECONDS, TimeUnit.SECONDS);
  }

  public void markOffline(String userId) {
    // GEO is stored in a ZSET under the hood, but Spring provides remove via geo ops
    redis.opsForGeo().remove(GEO_KEY, userId);
    redis.delete(META_KEY_PREFIX + userId);
  }

  public List<LiveUserDTO> findNearby(double lat, double lon, double radiusKm, int limit) {
    // GEOSEARCH around given point, within radius
    Distance radius = new Distance(radiusKm, Metrics.KILOMETERS);

    GeoResults<RedisGeoCommands.GeoLocation<String>> results =
        redis.opsForGeo().radius(
            GEO_KEY,
            new Circle(new Point(lon, lat), radius),
            RedisGeoCommands.GeoRadiusCommandArgs.newGeoRadiusArgs()
                .includeDistance()
                .sortAscending()
                .limit(limit)
        );

    if (results == null) return List.of();

    List<LiveUserDTO> out = new ArrayList<>();
    for (GeoResult<RedisGeoCommands.GeoLocation<String>> r : results) {
      String userId = r.getContent().getName();
      Distance d = r.getDistance();

      Map<Object, Object> meta = redis.opsForHash().entries(META_KEY_PREFIX + userId);
      if (meta == null || meta.isEmpty()) {
        // TTL expired but GEO entry still there momentarily; clean up lazily
        markOffline(userId);
        continue;
      }

      String name = Objects.toString(meta.get("displayName"), userId);
      String interest = Objects.toString(meta.get("interest"), "General");
      String lastSeen = Objects.toString(meta.get("lastSeen"), Instant.now().toString());
      
      // Extract lat/lon from meta
      Double lastLat = null;
      Double lastLon = null;
      try {
        if (meta.get("lat") != null) lastLat = Double.parseDouble(meta.get("lat").toString());
        if (meta.get("lon") != null) lastLon = Double.parseDouble(meta.get("lon").toString());
      } catch (NumberFormatException e) {
        // Ignore parse errors
      }

      out.add(new LiveUserDTO(userId, name, interest, lastSeen, 
          d == null ? null : d.getValue(), 
          d == null ? null : d.getMetric().toString(),
          lastLat, lastLon, true));
    }
    return out;
  }

  /**
   * Get list of user IDs near a location (for Kafka fan-out)
   */
  public List<String> getNearbyUserIds(double lat, double lon, double radiusKm) {
    Distance radius = new Distance(radiusKm, Metrics.KILOMETERS);

    GeoResults<RedisGeoCommands.GeoLocation<String>> results =
        redis.opsForGeo().radius(
            GEO_KEY,
            new Circle(new Point(lon, lat), radius),
            RedisGeoCommands.GeoRadiusCommandArgs.newGeoRadiusArgs().sortAscending()
        );

    if (results == null) return List.of();

    List<String> userIds = new ArrayList<>();
    for (GeoResult<RedisGeoCommands.GeoLocation<String>> r : results) {
      userIds.add(r.getContent().getName());
    }
    return userIds;
  }
}

