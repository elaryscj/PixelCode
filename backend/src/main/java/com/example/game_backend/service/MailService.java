package com.example.game_backend.service;

import com.example.game_backend.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Sends e-mails, in this order of preference:
 * <ol>
 *   <li>BREVO_API_KEY set: Brevo's HTTPS API (works on Render's free plan, which blocks SMTP ports
 *       25 / 465 / 587). MAIL_FROM must be a sender address verified in Brevo.</li>
 *   <li>MAIL_HOST set: plain SMTP (a paid server or your own machine).</li>
 *   <li>Neither: the e-mail is printed to the backend console (development).</li>
 * </ol>
 * Sending happens in the background, so a reset request answers equally fast whether or not the account exists.
 */
@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);
    private static final URI BREVO = URI.create("https://api.brevo.com/v3/smtp/email");
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final ObjectProvider<JavaMailSender> sender;
    private final String from;
    private final String frontendUrl;
    private final String mailHost;
    private final String brevoKey;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ExecutorService outbox = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "mail-outbox");
        t.setDaemon(true);
        return t;
    });

    public MailService(ObjectProvider<JavaMailSender> sender,
                       @Value("${game.mail-from:no-reply@pixelcode.arena}") String from,
                       @Value("${game.frontend-url:http://localhost:5173}") String frontendUrl,
                       @Value("${spring.mail.host:}") String mailHost,
                       @Value("${game.brevo-api-key:}") String brevoKey) {
        this.sender = sender;
        this.from = from;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
        this.mailHost = mailHost;
        this.brevoKey = brevoKey == null ? "" : brevoKey.trim();
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

    /** A note to the operator (MAIL_FROM), e.g. a new teacher subscription request. */
    public void notifyOwner(String subject, String text) {
        send(from, subject, text);
    }

    private void send(String to, String subject, String text) {
        outbox.submit(() -> deliver(to, subject, text));
    }

    private void deliver(String to, String subject, String text) {
        if (!brevoKey.isBlank()) {
            sendViaBrevo(to, subject, text);
            return;
        }
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

    private void sendViaBrevo(String to, String subject, String text) {
        try {
            Map<String, Object> body = Map.of(
                    "sender", Map.of("name", "PixelCode Arena", "email", from),
                    "to", List.of(Map.of("email", to)),
                    "subject", subject,
                    "textContent", text);
            HttpRequest req = HttpRequest.newBuilder(BREVO)
                    .timeout(Duration.ofSeconds(15))
                    .header("api-key", brevoKey)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() / 100 != 2) {
                // e.g. 401 wrong key, 400 sender not verified: the body says which
                log.error("Brevo refused the e-mail to {}: HTTP {} {}", to, res.statusCode(), res.body());
            } else {
                log.info("E-mail sent to {} via Brevo", to);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.error("Could not send e-mail to {} via Brevo: {}", to, e.getMessage());
        }
    }
}
