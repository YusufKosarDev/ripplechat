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
import com.ripplechat.backend.poll.PollStore;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Seeds a public demo account ("demo") with realistic content so the "Try the
 * demo" button lands on a lively workspace instead of an empty screen.
 *
 * <p>Idempotent: persistent content (users, channels, messages, reactions) is
 * created only when the demo user is missing. The demo poll lives in the
 * in-memory {@link PollStore} (cleared on every restart), so it is re-seeded on
 * each startup if absent — see {@link #seedDemoPoll()}.
 */
@Service
@RequiredArgsConstructor
public class DemoSeedService {

    public static final String DEMO_USERNAME = "demo";
    private static final String DEMO_PASSWORD = "demo1234";
    private static final String GENERAL_CHANNEL = "genel";

    private final UserRepository userRepository;
    private final ChannelRepository channelRepository;
    private final ChannelMembershipRepository membershipRepository;
    private final MessageRepository messageRepository;
    private final MessageReactionRepository reactionRepository;
    private final PollStore pollStore;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public boolean seedContentIfAbsent() {
        if (userRepository.existsByUsername(DEMO_USERNAME)) {
            return false; // already seeded
        }

        User demo = user(DEMO_USERNAME, "demo@ripplechat.app", "Demo Kullanıcı", "indigo");
        User elif = user("elif", "elif@ripplechat.app", "Elif", "rose");
        User kerem = user("kerem", "kerem@ripplechat.app", "Kerem", "emerald");

        Channel general = channel(GENERAL_CHANNEL, "Herkese açık genel sohbet", demo, List.of(elif, kerem));
        Channel dev = channel("yazılım", "Kod, araçlar ve geliştirme", demo, List.of(elif, kerem));
        Channel design = channel("tasarım", "UI/UX ve görsel tasarım", demo, List.of(elif, kerem));

        // #genel — welcome + reactions + markdown + a thread
        Message welcome = message(general, demo,
                "RippleChat'e hoş geldin! 🎉 Burası gerçek zamanlı, topluluk odaklı bir sohbet alanı. "
                        + "Soldan kanallar arasında gezinebilir, mesaj gönderebilirsin.");
        react(welcome, elif, "🎉");
        react(welcome, kerem, "🔥");
        react(welcome, demo, "👍");

        message(general, elif, "Selam! Bir mesajın üstüne gelince beliren ＋ ile emoji reaksiyonu ekleyebilirsin 👀");
        Message md = message(general, kerem,
                "Markdown desteği var: **kalın**, *italik*, `satır içi kod` ve [bağlantılar](https://ripplechat.app) 🙂");
        react(md, elif, "👍");

        Message threadParent = message(general, demo,
                "Bir konuyu dağıtmadan tartışmak için thread kullanın — bu mesaja yanıt verin 🧵");
        reply(threadParent, elif, "Thread çalışıyor! Ana akış tertemiz kalıyor 🙌");
        reply(threadParent, kerem, "Süper, uzun tartışmalar için birebir.");

        // #yazılım — a syntax-highlighted code block
        message(dev, kerem, "Bugün ufak bir yardımcı yazdım:");
        message(dev, kerem,
                "```js\nfunction selamla(ad) {\n  return `Merhaba, ${ad}!`\n}\n\nconsole.log(selamla('RippleChat'))\n```");
        message(dev, elif, "Temiz görünüyor 👏 Kod blokları sözdizimi vurgulu geliyor.");

        // #tasarım
        message(design, elif, "Koyu tema gerçekten şık olmuş ✨ Sağ üstten açık/koyu geçiş yapabilirsiniz.");
        message(design, demo, "Mobilde de düzgün çalışıyor — responsive tasarım hazır.");
        return true;
    }

    /** Re-adds the demo poll to the in-memory store on startup if it's not there. */
    @Transactional(readOnly = true)
    public void seedDemoPoll() {
        channelRepository
                .findFirstByNameAndCreatedBy_UsernameAndDeletedFalse(GENERAL_CHANNEL, DEMO_USERNAME)
                .ifPresent(general -> {
                    if (!pollStore.byChannel(general.getId()).isEmpty()) {
                        return;
                    }
                    List<Poll.Option> options = List.of(
                            new Poll.Option("0", "JavaScript"),
                            new Poll.Option("1", "Java"),
                            new Poll.Option("2", "Python"),
                            new Poll.Option("3", "Go"));
                    Poll poll = new Poll(general.getId(), "Favori programlama diliniz?", options, DEMO_USERNAME);
                    poll.vote("elif", "0");
                    poll.vote("kerem", "1");
                    poll.vote(DEMO_USERNAME, "2");
                    pollStore.save(poll);
                });
    }

    // ── helpers ──────────────────────────────────────────────────────────────
    private User user(String username, String email, String displayName, String avatarColor) {
        User u = new User();
        u.setUsername(username);
        u.setEmail(email);
        u.setDisplayName(displayName);
        u.setAvatarColor(avatarColor);
        u.setPassword(passwordEncoder.encode(DEMO_PASSWORD));
        return userRepository.save(u);
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
