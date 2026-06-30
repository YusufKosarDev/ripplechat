package com.ripplechat.backend.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Sends plain-text transactional email, with a graceful-disable fallback that
 * mirrors the other credentialed integrations (Cloudinary, VAPID, Giphy): when
 * email is not configured the message is logged instead of sent, so the app
 * always boots and the password-reset / verification flows are still exercisable
 * in development.
 *
 * <p>Email is active only when {@code app.mail.enabled=true} <em>and</em> an SMTP
 * host is configured (so Spring Boot actually creates a {@link JavaMailSender}).
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender mailSender;
    private final boolean enabled;
    private final String from;

    public MailService(ObjectProvider<JavaMailSender> mailSenderProvider,
                       @Value("${app.mail.enabled:false}") boolean enabled,
                       @Value("${app.mail.from:no-reply@ripplechat.app}") String from) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.enabled = enabled;
        this.from = from;
    }

    /** True when email will actually be delivered (vs. logged). */
    public boolean isEnabled() {
        return enabled && mailSender != null;
    }

    public void send(String to, String subject, String body) {
        if (!isEnabled()) {
            // Logged at INFO so a developer can copy the action link from the
            // console. Never log this in a real deployment with mail disabled.
            log.info("[mail disabled] to={} subject=\"{}\"\n{}", to, subject, body);
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
        log.info("event=mail_sent to={} subject=\"{}\"", to, subject);
    }
}
