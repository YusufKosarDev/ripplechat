package com.ripplechat.backend.admin;

import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

/**
 * Promotes the usernames listed in {@code app.admin-usernames} (env
 * ADMIN_USERNAMES, comma-separated) to global admins on startup. This is the
 * bootstrap for the very first admin; further grants happen in the admin panel.
 * No-op when the property is empty.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository userRepository;
    private final List<String> adminUsernames;

    public AdminBootstrap(UserRepository userRepository,
                          @Value("${app.admin-usernames:}") String adminUsernames) {
        this.userRepository = userRepository;
        this.adminUsernames = Arrays.stream(adminUsernames.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (adminUsernames.isEmpty()) {
            return;
        }
        for (String username : adminUsernames) {
            User user = userRepository.findByUsername(username).orElse(null);
            if (user == null) {
                log.warn("ADMIN_USERNAMES lists \"{}\" but no such user exists yet.", username);
            } else if (!user.isAdmin()) {
                user.setAdmin(true);
                userRepository.save(user);
                log.info("Promoted \"{}\" to platform admin (from ADMIN_USERNAMES).", username);
            }
        }
    }
}
