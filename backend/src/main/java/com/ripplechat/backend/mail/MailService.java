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
    private final boolean logLinks;

    public MailService(ObjectProvider<JavaMailSender> mailSenderProvider,
                       @Value("${app.mail.enabled:false}") boolean enabled,
                       @Value("${app.mail.from:no-reply@ripplechat.app}") String from,
                       @Value("${app.mail.log-links:true}") boolean logLinks) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.enabled = enabled;
        this.from = from;
        this.logLinks = logLinks;
        if (!enabled || mailSenderProvider.getIfAvailable() == null) {
            log.warn("Email is not configured — password-reset and verification links will not be sent."
                    + (logLinks ? " They are written to this log instead." : ""));
        }
    }

    /** True when email will actually be delivered (vs. logged). */
    public boolean isEnabled() {
        return enabled && mailSender != null;
    }

    public void send(String to, String subject, String body) {
        if (!isEnabled()) {
            // The body carries the password-reset link, so writing it to the log
            // hands account access to anyone who can read the log. That is a fine
            // trade in development, where it is the only way to complete the flow
            // without an SMTP server — and not one to make in production, where
            // app.mail.log-links is off.
            if (logLinks) {
                log.info("[mail disabled] to={} subject=\"{}\"\n{}", to, subject, body);
            } else {
                log.warn("event=mail_dropped reason=not_configured to={} subject=\"{}\"", to, subject);
            }
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
