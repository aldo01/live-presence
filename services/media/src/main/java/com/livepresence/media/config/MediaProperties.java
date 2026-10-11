package com.livepresence.media.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Media/object-storage settings. Two endpoints matter:
 *  - {@code endpoint}: how THIS service reaches MinIO/S3 (inside the network).
 *  - {@code publicEndpoint}: the host baked into presigned URLs, which the
 *    browser must be able to resolve. The presign signature is bound to the
 *    host, so these must be signed against the public endpoint.
 */
@ConfigurationProperties(prefix = "app.media")
public class MediaProperties {
  private String bucket = "media";
  private String endpoint = "http://localhost:9000";
  private String publicEndpoint = "http://localhost:9000";
  private String region = "us-east-1";
  private String accessKey = "minioadmin";
  private String secretKey = "minioadmin123";
  private long maxUploadBytes = 10L * 1024 * 1024;
  private long uploadUrlTtlSeconds = 600;
  private long downloadUrlTtlSeconds = 3600;

  public String getBucket() { return bucket; }
  public void setBucket(String v) { this.bucket = v; }
  public String getEndpoint() { return endpoint; }
  public void setEndpoint(String v) { this.endpoint = v; }
  public String getPublicEndpoint() { return publicEndpoint; }
  public void setPublicEndpoint(String v) { this.publicEndpoint = v; }
  public String getRegion() { return region; }
  public void setRegion(String v) { this.region = v; }
  public String getAccessKey() { return accessKey; }
  public void setAccessKey(String v) { this.accessKey = v; }
  public String getSecretKey() { return secretKey; }
  public void setSecretKey(String v) { this.secretKey = v; }
  public long getMaxUploadBytes() { return maxUploadBytes; }
  public void setMaxUploadBytes(long v) { this.maxUploadBytes = v; }
  public long getUploadUrlTtlSeconds() { return uploadUrlTtlSeconds; }
  public void setUploadUrlTtlSeconds(long v) { this.uploadUrlTtlSeconds = v; }
  public long getDownloadUrlTtlSeconds() { return downloadUrlTtlSeconds; }
  public void setDownloadUrlTtlSeconds(long v) { this.downloadUrlTtlSeconds = v; }
}
