package com.example.presence.chat;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface ConversationRepository extends JpaRepository<ConversationEntity, UUID> {

  Optional<ConversationEntity> findByUser1IdAndUser2Id(UUID user1Id, UUID user2Id);

}
