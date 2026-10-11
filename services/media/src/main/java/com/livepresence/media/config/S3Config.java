package com.livepresence.media.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration
@EnableConfigurationProperties(MediaProperties.class)
public class S3Config {

  private final MediaProperties props;

  public S3Config(MediaProperties props) {
    this.props = props;
  }

  private StaticCredentialsProvider creds() {
    return StaticCredentialsProvider.create(
        AwsBasicCredentials.create(props.getAccessKey(), props.getSecretKey()));
  }

  // MinIO requires path-style addressing (http://host:9000/bucket/key).
  private S3Configuration pathStyle() {
    return S3Configuration.builder().pathStyleAccessEnabled(true).build();
  }

  /** Server-side client: reads originals and writes derived variants. */
  @Bean
  public S3Client s3Client() {
    return S3Client.builder()
        .endpointOverride(URI.create(props.getEndpoint()))
        .region(Region.of(props.getRegion()))
        .credentialsProvider(creds())
        .serviceConfiguration(pathStyle())
        .build();
  }

  /**
   * Presigner bound to the PUBLIC endpoint. Presigned URLs are signed against the
   * host the browser will connect to, so this must use the public endpoint, not
   * the in-network one.
   */
  @Bean
  public S3Presigner s3Presigner() {
    return S3Presigner.builder()
        .endpointOverride(URI.create(props.getPublicEndpoint()))
        .region(Region.of(props.getRegion()))
        .credentialsProvider(creds())
        .serviceConfiguration(pathStyle())
        .build();
  }
}
