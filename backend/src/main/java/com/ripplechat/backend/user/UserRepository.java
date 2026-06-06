package com.ripplechat.backend.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    /** True if another user (not {@code id}) already uses this email. */
    boolean existsByEmailAndIdNot(String email, UUID id);
}
