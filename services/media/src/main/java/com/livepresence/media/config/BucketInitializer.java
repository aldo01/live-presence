package com.livepresence.media.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CORSConfiguration;
import software.amazon.awssdk.services.s3.model.CORSRule;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.PutBucketCorsRequest;
import software.amazon.awssdk.services.s3.model.PutBucketEncryptionRequest;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;
import software.amazon.awssdk.services.s3.model.ServerSideEncryptionByDefault;
import software.amazon.awssdk.services.s3.model.ServerSideEncryptionConfiguration;
import software.amazon.awssdk.services.s3.model.ServerSideEncryptionRule;

/**
 * Ensures the media bucket exists and that SSE-S3 (AES-256) is its default
 * encryption, so every object — including presigned uploads — is encrypted at
 * rest automatically. SeaweedFS (and S3) do not create buckets implicitly.
 */
@Configuration
public class BucketInitializer {

  private static final Logger log = LoggerFactory.getLogger(BucketInitializer.class);

  @Bean
  public ApplicationRunner ensureBucket(S3Client s3, MediaProperties props) {
    return args -> {
      String bucket = props.getBucket();

      // The object store may still be starting; retry the readiness/ensure step.
      boolean ready = false;
      for (int attempt = 1; attempt <= 15 && !ready; attempt++) {
        try {
          try {
            s3.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
            log.info("media bucket '{}' present", bucket);
          } catch (Exception notFound) {
            s3.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
            log.info("created media bucket '{}'", bucket);
          }
          ready = true;
        } catch (Exception e) {
          log.info("waiting for object store (attempt {}/15): {}", attempt, e.getMessage());
          Thread.sleep(3000);
        }
      }
      if (!ready) {
        log.warn("could not ensure media bucket '{}' after retries", bucket);
        return;
      }

      // Default bucket encryption → all objects encrypted at rest with SSE-S3.
      try {
        s3.putBucketEncryption(PutBucketEncryptionRequest.builder()
            .bucket(bucket)
            .serverSideEncryptionConfiguration(ServerSideEncryptionConfiguration.builder()
                .rules(ServerSideEncryptionRule.builder()
                    .applyServerSideEncryptionByDefault(ServerSideEncryptionByDefault.builder()
                        .sseAlgorithm(ServerSideEncryption.AES256)
                        .build())
                    .build())
                .build())
            .build());
        log.info("default SSE-S3 (AES-256) encryption enabled on bucket '{}'", bucket);
      } catch (Exception e) {
        log.warn("could not set default encryption on '{}': {}", bucket, e.toString());
      }

      // CORS so the browser can PUT directly to storage via presigned URLs.
      try {
        s3.putBucketCors(PutBucketCorsRequest.builder()
            .bucket(bucket)
            .corsConfiguration(CORSConfiguration.builder()
                .corsRules(CORSRule.builder()
                    .allowedOrigins("*")
                    .allowedMethods("GET", "PUT", "POST", "HEAD")
                    .allowedHeaders("*")
                    .exposeHeaders("ETag")
                    .maxAgeSeconds(3600)
                    .build())
                .build())
            .build());
        log.info("CORS configured on bucket '{}'", bucket);
      } catch (Exception e) {
        log.warn("could not set CORS on '{}': {}", bucket, e.toString());
      }
    };
  }
}

