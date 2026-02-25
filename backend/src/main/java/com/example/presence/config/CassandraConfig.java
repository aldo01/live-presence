package com.example.presence.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.List;
import com.datastax.oss.driver.api.core.CqlSession;
import org.springframework.data.cassandra.core.CassandraTemplate;
import org.springframework.data.cassandra.core.convert.CassandraConverter;
import org.springframework.data.cassandra.config.AbstractCassandraConfiguration;
import org.springframework.data.cassandra.config.SchemaAction;
import org.springframework.data.cassandra.repository.config.EnableCassandraRepositories;

@Configuration
@EnableCassandraRepositories(basePackages = "com.example.presence.chat.cassandra")
public class CassandraConfig extends AbstractCassandraConfiguration {

  @Value("${spring.data.cassandra.keyspace-name}")
  private String keyspaceName;

  @Value("${spring.data.cassandra.contact-points}")
  private String contactPoints;

  @Value("${spring.data.cassandra.port:9042}")
  private int port;

  @Value("${spring.data.cassandra.local-datacenter}")
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

  @Bean
  @Primary
  public CqlSession cqlSession() {
    // contactPoints may be a comma separated list like host:port
    String[] cps = contactPoints.split(",");
    List<InetSocketAddress> addrs = new ArrayList<>();
    for (String cp : cps) {
      String trimmed = cp.trim();
      if (trimmed.isEmpty()) continue;
      String host = trimmed;
      int p = port;
      if (trimmed.contains(":")) {
        String[] parts = trimmed.split(":");
        host = parts[0];
        try { p = Integer.parseInt(parts[1]); } catch (NumberFormatException ignored) {}
      }
      addrs.add(new InetSocketAddress(host, p));
    }

    var builder = CqlSession.builder()
      .withLocalDatacenter(localDatacenter)
      .withKeyspace(keyspaceName);
    for (InetSocketAddress a : addrs) {
      builder.addContactPoint(a);
    }

    return builder.build();
  }

  @Bean
  public CassandraTemplate cassandraTemplate(CqlSession session, CassandraConverter converter) {
    return new CassandraTemplate(session, converter);
  }
}
