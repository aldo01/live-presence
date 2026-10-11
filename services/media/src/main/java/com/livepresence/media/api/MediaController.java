package com.livepresence.media.api;

import com.livepresence.media.security.JwtAuthFilter.JwtPrincipal;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.HandlerMapping;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Map;

/**
 * Media endpoints. Uploads/downloads happen DIRECTLY between the browser and the
 * object store via short-lived presigned URLs; this controller only issues those
 * URLs and triggers server-side image optimization.
 */
@RestController
@RequestMapping("/api/media")
public class MediaController {

  private final MediaService media;

  public MediaController(MediaService media) {
    this.media = media;
  }

  public record PresignUploadRequest(String filename, String contentType, long size, String scope) {}
  public record FinalizeRequest(String key, String contentType) {}
  public record DownloadRequest(String key) {}

  /** Step 1: get a presigned PUT URL to upload the file straight to storage. */
  @PostMapping("/presign-upload")
  public ResponseEntity<?> presignUpload(@AuthenticationPrincipal JwtPrincipal p,
                                         @RequestBody PresignUploadRequest req) {
    if (p == null) return ResponseEntity.status(401).body(Map.of("error", "unauthenticated"));
    try {
      return ResponseEntity.ok(
          media.presignUpload(p.subject(), req.filename(), req.contentType(), req.size(), req.scope()));
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
  }

  /** Step 2 (after the PUT): optimize images into display + thumbnail variants. */
  @PostMapping("/finalize")
  public ResponseEntity<?> finalizeUpload(@AuthenticationPrincipal JwtPrincipal p,
                                          @RequestBody FinalizeRequest req) {
    if (p == null) return ResponseEntity.status(401).body(Map.of("error", "unauthenticated"));
    if (req.key() == null || req.key().isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "key is required"));
    }
    return ResponseEntity.ok(media.finalizeUpload(req.key(), req.contentType()));
  }

  /** Get a short-lived presigned GET URL to view/download an object. */
  @PostMapping("/download-url")
  public ResponseEntity<?> downloadUrl(@AuthenticationPrincipal JwtPrincipal p,
                                       @RequestBody DownloadRequest req) {
    if (p == null) return ResponseEntity.status(401).body(Map.of("error", "unauthenticated"));
    if (req.key() == null || req.key().isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "key is required"));
    }
    return ResponseEntity.ok(media.presignDownload(req.key()));
  }

  /**
   * Stable, cacheable, auth-free GET for display-only assets (avatars). The key
   * contains slashes, so we capture the full wildcard path. Returns the decrypted
   * bytes straight from object storage with a long cache lifetime.
   */
  @GetMapping("/public/**")
  public ResponseEntity<byte[]> servePublic(HttpServletRequest request) {
    String full = (String) request.getAttribute(HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE);
    String key = full.substring(full.indexOf("/public/") + "/public/".length());
    if (key.isBlank()) return ResponseEntity.notFound().build();
    try {
      MediaService.StreamedObject obj = media.streamObject(key);
      MediaType mt;
      try {
        mt = MediaType.parseMediaType(obj.contentType());
      } catch (Exception e) {
        mt = MediaType.APPLICATION_OCTET_STREAM;
      }
      return ResponseEntity.ok()
          .contentType(mt)
          .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
          .body(obj.bytes());
    } catch (Exception e) {
      return ResponseEntity.notFound().build();
    }
  }
}
