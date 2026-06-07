package com.ripplechat.backend.presence;

import com.ripplechat.backend.user.UserRepository;
import com.ripplechat.backend.user.dto.UserSummary;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/presence")
public class PresenceController {

    private final PresenceService presenceService;
    private final UserRepository userRepository;

    public PresenceController(PresenceService presenceService, UserRepository userRepository) {
        this.presenceService = presenceService;
        this.userRepository = userRepository;
    }

    @GetMapping("/online")
    public List<UserSummary> online() {
        return userRepository.findByUsernameIn(presenceService.onlineUsernames()).stream()
                .map(UserSummary::from)
                .toList();
    }
}
