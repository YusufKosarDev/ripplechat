package com.ripplechat.backend.e2ee;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "signed_pre_keys")
@Getter @Setter @NoArgsConstructor
public class SignedPreKey {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "key_id", nullable = false)
    private int keyId;

    @Column(name = "public_key", nullable = false, columnDefinition = "TEXT")
    private String publicKey;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String signature;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();
}
