package com.ripplechat.backend.demo;

import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.channel.membership.ChannelMembership;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.channel.membership.MembershipRole;
import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.message.MessageReaction;
import com.ripplechat.backend.message.MessageReactionRepository;
import com.ripplechat.backend.message.MessageRepository;
import com.ripplechat.backend.poll.Poll;
import com.ripplechat.backend.poll.PollRepository;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

/**
 * Seeds a public demo account ("demo") with realistic content so the "Try the
 * demo" button lands on a lively workspace instead of an empty screen.
 *
 * <p>Idempotent: all demo content (users, channels, messages, reactions and a
 * poll) is created only when the demo user is missing.
 */
@Service
@RequiredArgsConstructor
public class DemoSeedService {

    public static final String DEMO_USERNAME = "demo";
    private static final String DEMO_PASSWORD = "demo1234";

    /** Non-demo seed accounts are never signed into; they get a throwaway secret. */
    private static final SecureRandom RANDOM = new SecureRandom();

    private static final String GENERAL_CHANNEL = "general";
    private static final String DEV_CHANNEL = "engineering";
    private static final String DESIGN_CHANNEL = "design";
    private static final List<String> SEED_CHANNELS = List.of(GENERAL_CHANNEL, DEV_CHANNEL, DESIGN_CHANNEL);

    /**
     * The names these channels had before the workspace was translated to
     * English. {@code V38__demo_workspace_english.sql} renames them in place,
     * but {@link #resetMutableDemoState()} must recognise the old names too:
     * on a database where that migration has not run, treating them as junk
     * would soft-delete the entire demo workspace on the next nightly sweep.
     */
    private static final List<String> LEGACY_SEED_CHANNELS = List.of("genel", "yazılım", "tasarım");

    /**
     * Disappearing-message timer applied to the seed channels. Visitor messages
     * get an expiry stamped at send time and the existing sweep removes them a
     * day later; the seed messages predate the timer (expiresAt = null) and are
     * permanent, so the demo cleans itself without a bulk delete.
     */
    private static final int SEED_CHANNEL_TTL_SECONDS = 86_400;

    private final UserRepository userRepository;
    private final ChannelRepository channelRepository;
    private final ChannelMembershipRepository membershipRepository;
    private final MessageRepository messageRepository;
    private final MessageReactionRepository reactionRepository;
    private final PollRepository pollRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public boolean seedContentIfAbsent() {
        if (userRepository.existsByUsername(DEMO_USERNAME)) {
            return false; // already seeded
        }

        // The wording here is deliberately identical to the fixture in
        // frontend/e2e/screenshots.spec.ts, which is what docs/screenshots/*.png
        // are generated from — so what a visitor lands on matches the README.
        User demo = user(DEMO_USERNAME, "demo@ripplechat.app", "Demo User", "indigo");
        User elif = user("elif", "elif@ripplechat.app", "Elif", "rose");
        User kerem = user("kerem", "kerem@ripplechat.app", "Kerem", "emerald");

        Channel general = channel(GENERAL_CHANNEL, "Open to everyone", demo, List.of(elif, kerem));
        Channel dev = channel(DEV_CHANNEL, "Code, tooling and releases", demo, List.of(elif, kerem));
        Channel design = channel(DESIGN_CHANNEL, "UI/UX and visual design", demo, List.of(elif, kerem));

        // #general — welcome + reactions + markdown + a thread
        Message welcome = message(general, demo, "Welcome to RippleChat! 🎉");
        react(welcome, elif, "🔥");

        message(general, elif, "Hey! We just moved the team over here 👋");
        message(general, kerem, "It is realtime — messages land the moment you hit send ⚡");

        Message threadParent = message(general, demo,
                "React with an emoji, or open a thread on any message 🧵");
        react(threadParent, elif, "🎉");
        react(threadParent, kerem, "🎉");
        reply(threadParent, elif, "Threads keep the main channel readable 🙌");
        reply(threadParent, kerem, "Exactly — ideal for the long discussions.");

        message(general, elif, "Markdown works too: **bold**, *italic* and `inline code` 🙂");
        message(general, kerem,
                "```js\nfunction greet(name) {\n  return `Hello, ${name}!`\n}\nconsole.log(greet(\"RippleChat\"))\n```");

        // #engineering
        message(dev, kerem, "Search runs on Elasticsearch, with a PostgreSQL fallback");
        message(dev, elif, "Code blocks come through syntax-highlighted 👏");

        // #design
        message(design, elif, "The dark theme turned out well ✨ Toggle it from the top right.");
        message(design, demo, "Works on mobile too — the layout is fully responsive.");
        return true;
    }

    /**
     * Applies the self-cleaning timer to the seed channels. Idempotent backfill:
     * also upgrades a live demo workspace that was seeded before the timer existed.
     */
    @Transactional
    public void applySeedChannelTtl() {
        for (String name : SEED_CHANNELS) {
            channelRepository
                    .findFirstByNameAndCreatedBy_UsernameAndDeletedFalse(name, DEMO_USERNAME)
                    .ifPresent(channel -> {
                        if (channel.getMessageTtlSeconds() == null) {
                            channel.setMessageTtlSeconds(SEED_CHANNEL_TTL_SECONDS);
                            channelRepository.save(channel);
                        }
                    });
        }
    }

    /**
     * Nightly reset of everything a visitor can break on the shared demo login.
     * The demo password is public, so anyone can change the account's password,
     * enable 2FA (locking every future visitor out), scribble over the profile,
     * or fill the sidebar with junk channels. This restores the seed identity
     * and soft-deletes visitor-created channels; visitor <em>messages</em> are
     * left to the disappearing-message sweep ({@link #applySeedChannelTtl()}).
     */
    @Transactional
    public void resetMutableDemoState() {
        userRepository.findByUsername(DEMO_USERNAME).ifPresent(demo -> {
            demo.setPassword(passwordEncoder.encode(DEMO_PASSWORD));
            demo.setTwoFactorEnabled(false);
            demo.setTotpSecret(null);
            demo.setDisplayName("Demo User");
            demo.setAvatarColor("indigo");
            demo.setAvatarUrl(null);
            demo.setStatusEmoji(null);
            demo.setStatusText(null);
            demo.setStatusExpiresAt(null);
            demo.setDndUntil(null);
            userRepository.save(demo);
        });

        for (Channel channel : channelRepository.findByCreatedBy_UsernameAndDeletedFalse(DEMO_USERNAME)) {
            // DMs a visitor opened have a null name; they are junk too.
            String name = channel.getName();
            boolean isSeedChannel =
                    name != null && (SEED_CHANNELS.contains(name) || LEGACY_SEED_CHANNELS.contains(name));
            if (!isSeedChannel) {
                channel.setDeleted(true);
                channelRepository.save(channel);
            }
        }
    }

    /**
     * Seeds a demo poll in #general if the channel exists and has none yet. Polls
     * are now persistent, so this is a one-time, idempotent backfill (it also
     * adds the poll to a demo workspace that predates persistent polls).
     */
    @Transactional
    public void seedDemoPollIfAbsent() {
        channelRepository
                .findFirstByNameAndCreatedBy_UsernameAndDeletedFalse(GENERAL_CHANNEL, DEMO_USERNAME)
                .ifPresent(general -> {
                    if (!pollRepository.findByChannelIdOrderByCreatedAtAsc(general.getId()).isEmpty()) {
                        return;
                    }
                    Poll poll = new Poll(general.getId(), "What's your favourite programming language?", DEMO_USERNAME);
                    poll.addOption("0", "JavaScript", 0);
                    poll.addOption("1", "Java", 1);
                    poll.addOption("2", "Python", 2);
                    poll.addOption("3", "Go", 3);
                    poll.vote("elif", "0");
                    poll.vote("kerem", "1");
                    poll.vote(DEMO_USERNAME, "2");
                    pollRepository.save(poll);
                });
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /**
     * Creates a seed user.
     *
     * <p>Only the {@code demo} account gets the published password; the others
     * exist to populate the conversation and are never signed into, so they get
     * a random one. They previously all shared {@code demo1234}, which meant a
     * public deployment shipped three accounts whose credentials were in the
     * source rather than one.
     */
    private User user(String username, String email, String displayName, String avatarColor) {
        User u = new User();
        u.setUsername(username);
        u.setEmail(email);
        u.setDisplayName(displayName);
        u.setAvatarColor(avatarColor);
        u.setPassword(passwordEncoder.encode(
                DEMO_USERNAME.equals(username) ? DEMO_PASSWORD : randomPassword()));
        return userRepository.save(u);
    }

    private static String randomPassword() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private Channel channel(String name, String description, User owner, List<User> members) {
        Channel c = new Channel();
        c.setName(name);
        c.setDescription(description);
        c.setPrivate(false);
        c.setCreatedBy(owner);
        channelRepository.save(c);
        membership(c, owner, MembershipRole.OWNER);
        for (User m : members) {
            membership(c, m, MembershipRole.MEMBER);
        }
        return c;
    }

    private void membership(Channel channel, User user, MembershipRole role) {
        ChannelMembership m = new ChannelMembership();
        m.setChannel(channel);
        m.setUser(user);
        m.setRole(role);
        membershipRepository.save(m);
    }

    private Message message(Channel channel, User sender, String content) {
        Message m = new Message();
        m.setChannel(channel);
        m.setSender(sender);
        m.setContent(content);
        return messageRepository.save(m);
    }

    private void reply(Message parent, User sender, String content) {
        Message m = new Message();
        m.setChannel(parent.getChannel());
        m.setSender(sender);
        m.setContent(content);
        m.setParent(parent);
        messageRepository.save(m);
    }

    private void react(Message message, User user, String emoji) {
        MessageReaction r = new MessageReaction();
        r.setMessage(message);
        r.setUser(user);
        r.setEmoji(emoji);
        reactionRepository.save(r);
    }
}
