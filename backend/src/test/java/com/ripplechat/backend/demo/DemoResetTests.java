package com.ripplechat.backend.demo;

import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class DemoResetTests extends AbstractIntegrationTest {

    @Autowired
    private DemoSeedService seedService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ChannelRepository channelRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void seedDemoWorkspace() {
        seedService.seedContentIfAbsent();
        seedService.applySeedChannelTtl();
    }

    @Test
    void seedChannelsGetTheSelfCleaningTimer() {
        Channel general = channelRepository
                .findFirstByNameAndCreatedBy_UsernameAndDeletedFalse("genel", DemoSeedService.DEMO_USERNAME)
                .orElseThrow();
        assertThat(general.getMessageTtlSeconds()).isEqualTo(86_400);
    }

    @Test
    void resetRestoresEverythingAVisitorCanBreakOnTheDemoAccount() {
        User demo = userRepository.findByUsername(DemoSeedService.DEMO_USERNAME).orElseThrow();
        demo.setPassword(passwordEncoder.encode("hijacked-pass"));
        demo.setTwoFactorEnabled(true);
        demo.setTotpSecret("stolen-secret");
        demo.setDisplayName("Hacked");
        demo.setAvatarColor("rose");
        demo.setStatusEmoji("💀");
        demo.setStatusText("pwned");
        demo.setDndUntil(Instant.now().plusSeconds(3600));
        userRepository.save(demo);

        seedService.resetMutableDemoState();

        User reset = userRepository.findByUsername(DemoSeedService.DEMO_USERNAME).orElseThrow();
        assertThat(passwordEncoder.matches("demo1234", reset.getPassword()))
                .as("the public demo password is restored")
                .isTrue();
        assertThat(reset.isTwoFactorEnabled()).isFalse();
        assertThat(reset.getTotpSecret()).isNull();
        assertThat(reset.getDisplayName()).isEqualTo("Demo Kullanıcı");
        assertThat(reset.getAvatarColor()).isEqualTo("indigo");
        assertThat(reset.getStatusEmoji()).isNull();
        assertThat(reset.getStatusText()).isNull();
        assertThat(reset.getDndUntil()).isNull();
    }

    @Test
    void resetRemovesVisitorChannelsButKeepsTheSeedWorkspace() {
        User demo = userRepository.findByUsername(DemoSeedService.DEMO_USERNAME).orElseThrow();
        Channel junk = new Channel();
        junk.setName("ziyaretçi-çöplüğü");
        junk.setCreatedBy(demo);
        channelRepository.save(junk);

        seedService.resetMutableDemoState();

        assertThat(channelRepository.findById(junk.getId()).orElseThrow().isDeleted()).isTrue();
        for (String name : new String[] {"genel", "yazılım", "tasarım"}) {
            assertThat(channelRepository
                    .findFirstByNameAndCreatedBy_UsernameAndDeletedFalse(name, DemoSeedService.DEMO_USERNAME))
                    .as("seed channel %s survives the reset", name)
                    .isPresent();
        }
    }
}
