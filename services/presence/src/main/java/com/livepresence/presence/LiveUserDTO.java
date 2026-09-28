package com.livepresence.presence;

public record LiveUserDTO(
    String userId,
    String displayName,
    String interest,
    String lastSeenIso,
    Double distanceValue,
    String distanceUnit,
    Double lastLat,
    Double lastLon,
    Boolean live
) {}
