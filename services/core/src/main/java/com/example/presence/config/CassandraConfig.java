package com.example.presence.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.cassandra.config.AbstractCassandraConfiguration;
import org.springframework.data.cassandra.config.SchemaAction;
import org.springframework.data.cassandra.core.cql.keyspace.CreateKeyspaceSpecification;
import org.springframework.data.cassandra.core.cql.keyspace.DataCenterReplication;
import org.springframework.data.cassandra.repository.config.EnableCassandraRepositories;

/**
 * Cassandra/ScyllaDB configuration for the durable chat message store.
 *
 * Only active when {@code app.cassandra.enabled=true}. We rely on Spring Data's
 * session factory (not a hand-rolled CqlSession) so that:
 *   1. the keyspace is auto-created via {@link #getKeyspaceCreations()} before
 *      the session binds to it (a hand-rolled session with .withKeyspace() fails
 *      if the keyspace does not yet exist on a fresh cluster), and
 *   2. the message table is auto-created from the entity via CREATE_IF_NOT_EXISTS.
 */
@Configuration
@ConditionalOnProperty(name = "app.cassandra.enabled", havingValue = "true")
@EnableCassandraRepositories(basePackages = "com.example.presence.chat.cassandra")
public class CassandraConfig extends AbstractCassandraConfiguration {

  @Value("${spring.data.cassandra.keyspace-name:livepresence_chat}")
  private String keyspaceName;

  @Value("${spring.data.cassandra.contact-points:localhost}")
  private String contactPoints;

  @Value("${spring.data.cassandra.port:9042}")
  private int port;

  @Value("${spring.data.cassandra.local-datacenter:datacenter1}")
  private String localDatacenter;

  @Override
  protected String getKeyspaceName() {
    return keyspaceName;
  }

  @Override
  protected String getContactPoints() {
    return contactPoints;
  }

  @Override
  protected int getPort() {
    return port;
  }

  @Override
  protected String getLocalDataCenter() {
    return localDatacenter;
  }

  @Override
  public SchemaAction getSchemaAction() {
    return SchemaAction.CREATE_IF_NOT_EXISTS;
  }

  @Override
  public String[] getEntityBasePackages() {
    return new String[]{"com.example.presence.chat.cassandra"};
  }

  @Override
  protected List<CreateKeyspaceSpecification> getKeyspaceCreations() {
    // ScyllaDB uses tablets by default, which require NetworkTopologyStrategy
    // (SimpleStrategy is rejected). RF 1 on the single dev datacenter; use a
    // higher RF across datacenters in production.
    return List.of(
        CreateKeyspaceSpecification.createKeyspace(keyspaceName)
            .ifNotExists()
            .withNetworkReplication(DataCenterReplication.of(localDatacenter, 1)));
  }
}
