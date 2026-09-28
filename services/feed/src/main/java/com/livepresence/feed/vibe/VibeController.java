package com.livepresence.feed.vibe;

import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * Read-only catalog of vibes. Clients call this once and use it to render the
 * vibe filter bar, the composer picker, and per-post vibe chips — so there is
 * no hard-coded vibe list on the client anymore.
 */
@RestController
@RequestMapping("/api/vibes")
public class VibeController {

    @GetMapping
    public ResponseEntity<List<Vibe>> list() {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
            .body(VibeCatalog.all());
    }
}
