package com.ripplechat.backend.mail;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Mail is sent from inside the transaction that did the thing the message is
 * about, so what happens when delivery fails decides whether that work survives.
 */
class MailServiceTest {

    private static ObjectProvider<JavaMailSender> providerFor(JavaMailSender sender) {
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(sender);
        return provider;
    }

    @Test
    void aDeliveryFailureIsLoggedRatherThanThrown() {
        JavaMailSender sender = mock(JavaMailSender.class);
        doThrow(new MailSendException("smtp is having a moment"))
                .when(sender).send(any(SimpleMailMessage.class));
        MailService mail = new MailService(providerFor(sender), true, "no-reply@ripplechat.app", false);

        // Registration issues the verification token and then sends. Letting the
        // exception out rolled the whole registration back, so an SMTP blip meant
        // nobody could sign up and the account they thought they had made was
        // gone. The token is already persisted; asking for the mail again is the
        // recovery, and that needs the row to still be there.
        assertThatCode(() -> mail.send("someone@example.com", "Verify your email", "link"))
                .doesNotThrowAnyException();
    }

    @Test
    void aWorkingSenderStillGetsTheMessage() {
        JavaMailSender sender = mock(JavaMailSender.class);
        MailService mail = new MailService(providerFor(sender), true, "no-reply@ripplechat.app", false);

        mail.send("someone@example.com", "Verify your email", "link");

        verify(sender).send(any(SimpleMailMessage.class));
    }

    @Test
    void withoutASenderNothingIsAttemptedAndNothingIsThrown() {
        MailService mail = new MailService(providerFor(null), false, "no-reply@ripplechat.app", false);

        assertThatCode(() -> mail.send("someone@example.com", "Verify your email", "link"))
                .doesNotThrowAnyException();
    }
}
