package com.livepresence.media.api;

import com.livepresence.media.config.MediaProperties;
import net.coobird.thumbnailator.Thumbnails;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;

/**
 * Presigns direct-to-store uploads/downloads and runs the image-optimization
 * worker (resize + thumbnail). Bytes never flow through this service on the
 * hot path — only the derived variants are read/written server-side.
 *
 * Encryption at rest is handled by the bucket's default SSE-S3 policy (AES-256),
 * so every object — including presigned uploads and the variants written here —
 * is encrypted on disk automatically; TLS covers transit in production.
 */
@Service
public class MediaService {

  private static final Logger log = LoggerFactory.getLogger(MediaService.class);
  private static final Set<String> SCOPES = Set.of("chat", "post", "avatar");
  // Only re-encode formats ImageIO handles losslessly as input; others are stored as-is.
  private static final Set<String> OPTIMIZABLE = Set.of("image/jpeg", "image/png");
  private static final int DISPLAY_MAX = 1600;
  private static final int THUMB_MAX = 256;

  private final S3Client s3;
  private final S3Presigner presigner;
  private final MediaProperties props;

  public MediaService(S3Client s3, S3Presigner presigner, MediaProperties props) {
    this.s3 = s3;
    this.presigner = presigner;
    this.props = props;
  }

  public record PresignUpload(String uploadUrl, String key, long expiresInSeconds, long maxBytes,
                              java.util.Map<String, String> headers) {}
  public record PresignDownload(String downloadUrl, String key, long expiresInSeconds) {}
  public record Finalized(String key, String displayKey, String thumbKey,
                          Integer width, Integer height, boolean optimized) {}

  /** Validate + presign a direct PUT to the object store (encrypted with SSE-S3). */
  public PresignUpload presignUpload(String userId, String filename, String contentType,
                                     long size, String scope) {
    if (size <= 0 || size > props.getMaxUploadBytes()) {
      throw new IllegalArgumentException(
          "file size must be between 1 byte and " + props.getMaxUploadBytes() + " bytes");
    }
    if (contentType == null || contentType.isBlank()) {
      throw new IllegalArgumentException("contentType is required");
    }
    String safeScope = SCOPES.contains(scope) ? scope : "misc";
    String key = safeScope + "/" + userId + "/" + UUID.randomUUID() + "-" + sanitize(filename);

    // Request SSE-S3 (AES-256) at rest. This signs the x-amz-server-side-encryption
    // header into the URL, so the client must echo it on the PUT (returned below).
    PutObjectRequest por = PutObjectRequest.builder()
        .bucket(props.getBucket())
        .key(key)
        .contentType(contentType)
        .serverSideEncryption(software.amazon.awssdk.services.s3.model.ServerSideEncryption.AES256)
        .build();

    PutObjectPresignRequest pre = PutObjectPresignRequest.builder()
        .signatureDuration(Duration.ofSeconds(props.getUploadUrlTtlSeconds()))
        .putObjectRequest(por)
        .build();

    String url = presigner.presignPutObject(pre).url().toString();
    var headers = new java.util.LinkedHashMap<String, String>();
    headers.put("Content-Type", contentType);
    headers.put("x-amz-server-side-encryption", "AES256");
    return new PresignUpload(url, key, props.getUploadUrlTtlSeconds(), props.getMaxUploadBytes(), headers);
  }

  /** Presign a short-lived GET so the browser can fetch the bytes directly. */
  public PresignDownload presignDownload(String key) {
    GetObjectRequest gor = GetObjectRequest.builder()
        .bucket(props.getBucket())
        .key(key)
        .build();
    GetObjectPresignRequest pre = GetObjectPresignRequest.builder()
        .signatureDuration(Duration.ofSeconds(props.getDownloadUrlTtlSeconds()))
        .getObjectRequest(gor)
        .build();
    String url = presigner.presignGetObject(pre).url().toString();
    return new PresignDownload(url, key, props.getDownloadUrlTtlSeconds());
  }

  public record StreamedObject(byte[] bytes, String contentType) {}

  /**
   * Reads an object's bytes server-side (SSE-S3 decryption is transparent) so we
   * can serve a STABLE, non-expiring public URL for display-only assets such as
   * avatars. Hot-path media (chat/posts) still uses presigned direct downloads.
   */
  public StreamedObject streamObject(String key) {
    ResponseBytes<GetObjectResponse> obj = s3.getObjectAsBytes(
        GetObjectRequest.builder().bucket(props.getBucket()).key(key).build());
    String contentType = obj.response().contentType();
    if (contentType == null || contentType.isBlank()) {
      contentType = "application/octet-stream";
    }
    return new StreamedObject(obj.asByteArray(), contentType);
  }

  /**
   * Called after the client finishes the direct upload. For images we generate a
   * resized display variant + a thumbnail and store them next to the original;
   * non-image documents are left as-is (already compressed).
   */
  public Finalized finalizeUpload(String key, String contentType) {
    if (contentType == null || !OPTIMIZABLE.contains(contentType.toLowerCase())) {
      return new Finalized(key, null, null, null, null, false);
    }
    try {
      ResponseBytes<GetObjectResponse> obj = s3.getObjectAsBytes(
          GetObjectRequest.builder().bucket(props.getBucket()).key(key).build());
      byte[] original = obj.asByteArray();

      Integer width = null, height = null;
      BufferedImage img = ImageIO.read(new ByteArrayInputStream(original));
      if (img != null) {
        width = img.getWidth();
        height = img.getHeight();
      }

      String displayKey = key + ".display.jpg";
      String thumbKey = key + ".thumb.jpg";
      put(displayKey, resize(original, DISPLAY_MAX, 0.82));
      put(thumbKey, resize(original, THUMB_MAX, 0.80));

      log.info("optimized {} ({}x{}) -> display+thumb", key, width, height);
      return new Finalized(key, displayKey, thumbKey, width, height, true);
    } catch (Exception e) {
      // Never fail the message/post because optimization hiccuped — fall back to
      // serving the original.
      log.warn("image optimization failed for {}: {}", key, e.toString());
      return new Finalized(key, null, null, null, null, false);
    }
  }

  private byte[] resize(byte[] data, int maxDim, double quality) throws Exception {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    Thumbnails.of(new ByteArrayInputStream(data))
        .size(maxDim, maxDim)
        .keepAspectRatio(true)
        .outputFormat("jpg")
        .outputQuality(quality)
        .toOutputStream(out);
    return out.toByteArray();
  }

  private void put(String key, byte[] bytes) {
    s3.putObject(
        PutObjectRequest.builder()
            .bucket(props.getBucket())
            .key(key)
            .contentType("image/jpeg")
            .serverSideEncryption(software.amazon.awssdk.services.s3.model.ServerSideEncryption.AES256)
            .build(),
        RequestBody.fromBytes(bytes));
  }

  private static String sanitize(String filename) {
    if (filename == null || filename.isBlank()) return "file";
    String base = filename.replaceAll(".*[/\\\\]", "");       // strip any path
    base = base.replaceAll("[^A-Za-z0-9._-]", "_");            // safe chars only
    return base.length() > 120 ? base.substring(base.length() - 120) : base;
  }
}
