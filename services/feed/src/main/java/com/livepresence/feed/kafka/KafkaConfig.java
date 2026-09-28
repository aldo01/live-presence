package com.livepresence.feed.kafka;

import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.*;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.kafka.support.serializer.JsonSerializer;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.util.HashMap;
import java.util.Map;

/**
 * Kafka Configuration for Event-Driven Architecture
 * 
 * Topics:
 * - post.created: New post creation events
 * - post.updated: Post update events
 * - post.deleted: Post deletion events
 * - feed.update: Feed update notifications
 */
@Configuration
@ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true")
@EnableKafka
public class KafkaConfig {

    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;

    @Value("${spring.kafka.consumer.group-id}")
    private String consumerGroupId;

    // Topic Definitions
    @Bean
    public NewTopic postCreatedTopic() {
        return TopicBuilder.name("post.created")
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic postUpdatedTopic() {
        return TopicBuilder.name("post.updated")
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic postDeletedTopic() {
        return TopicBuilder.name("post.deleted")
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic feedUpdateTopic() {
        return TopicBuilder.name("feed.update")
                .partitions(6)
                .replicas(1)
                .build();
    }

    // Producer Configuration
    @Bean
    public ProducerFactory<String, Object> producerFactory() {
        Map<String, Object> config = new HashMap<>();
        config.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        config.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        config.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        config.put(ProducerConfig.ACKS_CONFIG, "1"); // Leader acknowledgment
        config.put(ProducerConfig.RETRIES_CONFIG, 3);
        config.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "snappy");
        config.put(ProducerConfig.BATCH_SIZE_CONFIG, 16384);
        config.put(ProducerConfig.LINGER_MS_CONFIG, 10);
        return new DefaultKafkaProducerFactory<>(config);
    }

    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        return new KafkaTemplate<>(producerFactory());
    }

    // Consumer Configuration
    @Bean
    public ConsumerFactory<String, Object> consumerFactory() {
        Map<String, Object> config = new HashMap<>();
        config.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        config.put(ConsumerConfig.GROUP_ID_CONFIG, consumerGroupId);
        config.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        config.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        config.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        config.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, true);
        config.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 100);
        config.put(JsonDeserializer.TRUSTED_PACKAGES, "com.livepresence.feed.*");
        config.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, false);
        config.put(JsonDeserializer.VALUE_DEFAULT_TYPE, "com.livepresence.feed.kafka.events.PostEvent");
        return new DefaultKafkaConsumerFactory<>(config);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory = 
            new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory());
        factory.setConcurrency(3); // 3 consumer threads per partition
        return factory;
    }
}
