package com.ripplechat.backend.user;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    /** True if another user (not {@code id}) already uses this email. */
    boolean existsByEmailAndIdNot(String email, UUID id);

    /** Looks up a user by either username or email (used for login). */
    Optional<User> findByUsernameOrEmail(String username, String email);

    Optional<User> findByEmail(String email);

    /** Looks up a user by username (used to resolve the current principal). */
    Optional<User> findByUsername(String username);

    /** Resolves a set of usernames to users (used for the online presence list). */
    List<User> findByUsernameIn(Collection<String> usernames);

    /** Case-insensitive lookup by username or display name (for the direct-message picker). */
    @Query("""
            select u from User u
            where lower(u.username) like lower(concat('%', :q, '%'))
               or lower(u.displayName) like lower(concat('%', :q, '%'))
            order by u.username
            """)
    List<User> searchByUsernameOrDisplayName(@Param("q") String q, Pageable pageable);
}
