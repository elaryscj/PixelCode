package com.example.game_backend.service;

import com.example.game_backend.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/** Sends e-mails through SMTP when MAIL_HOST is configured, otherwise prints them to the console (dev). */
@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final ObjectProvider<JavaMailSender> sender;
    private final String from;
    private final String frontendUrl;
    private final String mailHost;

    public MailService(ObjectProvider<JavaMailSender> sender,
                       @Value("${game.mail-from:no-reply@pixelcode.arena}") String from,
                       @Value("${game.frontend-url:http://localhost:5173}") String frontendUrl,
                       @Value("${spring.mail.host:}") String mailHost) {
        this.sender = sender;
        this.from = from;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
        this.mailHost = mailHost;
    }

    public void sendResetLink(User user, String token) {
        String link = frontendUrl + "/reset-password?token=" + token;
        send(user.getEmail(), "PixelCode Arena: reset your password",
                "Hi " + user.getUsername() + ",\n\nOpen this link to choose a new password (valid for 30 minutes, one use):\n"
                        + link + "\n\nIf this was not you, just ignore this e-mail.");
    }

    public void sendWelcome(User user) {
        send(user.getEmail(), "Welcome to PixelCode Arena",
                "Hi " + user.getUsername() + ",\n\nYour account is ready. See you in the arena!");
    }

    private void send(String to, String subject, String text) {
        JavaMailSender s = mailHost.isBlank() ? null : sender.getIfAvailable();
        if (s == null) {
            log.warn("[MAIL not configured - printing instead] to={} subject={}\n{}", to, subject, text);
            return;
        }
        try {
            SimpleMailMessage m = new SimpleMailMessage();
            m.setFrom(from);
            m.setTo(to);
            m.setSubject(subject);
            m.setText(text);
            s.send(m);
        } catch (Exception e) {
            log.error("Could not send e-mail to {}: {}", to, e.getMessage());
        }
    }
}
