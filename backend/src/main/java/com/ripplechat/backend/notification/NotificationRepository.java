package com.ripplechat.backend.notification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByRecipient_IdOrderByCreatedAtDesc(UUID recipientId, Pageable pageable);

    long countByRecipient_IdAndReadFalse(UUID recipientId);

    @Modifying
    @Query("update Notification n set n.read = true where n.recipient.id = :recipientId and n.read = false")
    void markAllRead(@Param("recipientId") UUID recipientId);
}
