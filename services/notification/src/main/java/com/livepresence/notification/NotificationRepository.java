package com.livepresence.notification;

import java.time.Instant;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface NotificationRepository extends JpaRepository<NotificationEntity, UUID> {

  Page<NotificationEntity> findByRecipientIdOrderByCreatedAtDesc(UUID recipientId, Pageable pageable);

  long countByRecipientIdAndReadFalse(UUID recipientId);

  @Modifying
  @Transactional
  @Query("update NotificationEntity n set n.read = true, n.readAt = :readAt where n.recipientId = :recipientId and n.read = false")
  int markAllRead(@Param("recipientId") UUID recipientId, @Param("readAt") Instant readAt);
}
