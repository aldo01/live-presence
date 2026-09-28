package com.example.presence.kafka.consumers;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.geo.Circle;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.GeoResult;
import org.springframework.data.geo.GeoResults;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.data.redis.connection.RedisGeoCommands;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Read-only lookup of nearby user IDs from the shared presence Redis geo index.
 *
 * Presence data is owned and written by the presence-service; core only reads
 * the agreed-upon {@code presence:geo} key here for feed fan-out. This avoids a
 * synchronous HTTP hop on the hot fan-out path while keeping the services'
 * codebases decoupled (they share only the Redis key contract).
 */
@Component
public class NearbyUserLookup {

  private static final String GEO_KEY = "presence:geo";

  private final StringRedisTemplate redis;

  public NearbyUserLookup(StringRedisTemplate redis) {
    this.redis = redis;
  }

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
