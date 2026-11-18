package com.example.game_backend.payment;

import com.example.game_backend.entity.Payment;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.lesson.TeacherAccessService;
import com.example.game_backend.repository.PaymentRepository;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.service.MailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Online payment of the teacher subscription through Freedom Pay (docs.freedompay.kz, Merchant API):
 * the teacher picks a plan, we create a payment (init_payment.php) and send them to Freedom Pay's page; Freedom
 * Pay then calls our result URL, and a signed, successful notification switches the subscription on at once.
 *
 * <p>Off until FREEDOM_MERCHANT_ID and FREEDOM_SECRET_KEY are set (the teacher page then offers only the
 * request form). FREEDOM_TESTING=1 makes test payments with Freedom Pay's test cards.
 */
@Service
public class PaymentService {
    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);
    static final String INIT_URL = "https://api.freedompay.kz/init_payment.php";
    static final String RESULT_PATH = "/api/payments/freedom/result";
    private static final SecureRandom RND = new SecureRandom();

    private final PaymentRepository payments;
    private final UserRepository users;
    private final TeacherAccessService access;
    private final MailService mail;
    private final String merchantId;
    private final String secretKey;
    private final boolean testing;
    private final String backendUrl;
    private final String frontendUrl;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public PaymentService(PaymentRepository payments, UserRepository users, TeacherAccessService access, MailService mail,
                          @Value("${game.freedom.merchant-id:}") String merchantId,
                          @Value("${game.freedom.secret-key:}") String secretKey,
                          @Value("${game.freedom.testing:false}") boolean testing,
                          @Value("${game.backend-url:}") String backendUrl,
                          @Value("${game.frontend-url:http://localhost:5173}") String frontendUrl) {
        this.payments = payments;
        this.users = users;
        this.access = access;
        this.mail = mail;
        this.merchantId = merchantId == null ? "" : merchantId.trim();
        this.secretKey = secretKey == null ? "" : secretKey.trim();
        this.testing = testing;
        // Render tells every service its own public address
        String fromRender = System.getenv("RENDER_EXTERNAL_URL");
        String b = backendUrl != null && !backendUrl.isBlank() ? backendUrl : fromRender != null ? fromRender : "http://localhost:8080";
        this.backendUrl = b.replaceAll("/+$", "");
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    public boolean enabled() {
        return !merchantId.isEmpty() && !secretKey.isEmpty();
    }

    static int days(String plan) {
        return "YEAR".equals(plan) ? 365 : 30;
    }

    /** Creates the payment and returns the Freedom Pay page to send the teacher to. */
    public Map<String, Object> checkout(long userId, String rawPlan, String lang) {
        if (!enabled()) {
            throw new ApiException(503, "Online payment is not connected yet");
        }
        User u = users.findById(userId).orElseThrow(() -> new ApiException(401, "Please log in again"));
        String plan = rawPlan == null ? "" : rawPlan.trim().toUpperCase(Locale.ROOT);
        if (!TeacherAccessService.PLANS.contains(plan)) {
            throw new ApiException(400, "Choose a month or a year");
        }
        Map<String, Object> prices = access.plans();
        int amount = (int) prices.get("YEAR".equals(plan) ? "priceYear" : "priceMonth");
        String currency = String.valueOf(prices.get("currency"));

        Payment p = new Payment();
        p.setOrderId("pc-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24));
        p.setUserId(userId);
        p.setPlan(plan);
        p.setAmount(amount);
        p.setCurrency(currency);
        p.setTesting(testing);
        payments.save(p);

        Map<String, String> req = new TreeMap<>();
        req.put("pg_merchant_id", merchantId);
        req.put("pg_order_id", p.getOrderId());
        req.put("pg_amount", String.valueOf(amount));
        req.put("pg_currency", currency);
        req.put("pg_description", "PixelCode Arena: " + ("YEAR".equals(plan) ? "teacher mode, school year" : "teacher mode, 1 month")
                + " (" + u.getUsername() + ")");
        req.put("pg_salt", salt());
        req.put("pg_result_url", backendUrl + RESULT_PATH);
        req.put("pg_success_url", frontendUrl + "/teacher?paid=" + p.getOrderId());
        req.put("pg_failure_url", frontendUrl + "/teacher?payment=failed");
        req.put("pg_language", "kz".equals(lang) ? "kz" : "en".equals(lang) ? "en" : "ru");
        req.put("pg_lifetime", "3600");
        if (u.getEmail() != null && !u.getEmail().isBlank()) {
            req.put("pg_user_contact_email", u.getEmail());
        }
        if (testing) {
            req.put("pg_testing_mode", "1");
        }
        req.put("pg_sig", FreedomPaySignature.sign(FreedomPaySignature.scriptName(INIT_URL), req, secretKey));

        Map<String, String> res = post(INIT_URL, req);
        if (!"ok".equals(res.get("pg_status")) || res.get("pg_redirect_url") == null) {
            log.error("Freedom Pay refused payment {}: {} {}", p.getOrderId(), res.get("pg_error_code"), res.get("pg_error_description"));
            p.setStatus(Payment.FAILED);
            payments.save(p);
            throw new ApiException(502, "The payment service did not answer, please try again");
        }
        if (!FreedomPaySignature.valid(FreedomPaySignature.scriptName(INIT_URL), res, secretKey)) {
            log.error("Freedom Pay answer for {} has a wrong signature", p.getOrderId());
            throw new ApiException(502, "The payment service did not answer, please try again");
        }
        p.setProviderPaymentId(res.get("pg_payment_id"));
        payments.save(p);
        return Map.of("redirectUrl", res.get("pg_redirect_url"), "orderId", p.getOrderId());
    }

    /**
     * Freedom Pay's result notification. Returns the XML answer. Only a correctly signed notification of a known
     * order with the right amount counts; the same notification may come several times and is applied once.
     */
    @Transactional
    public String onResult(String requestPath, Map<String, String> params) {
        if (!FreedomPaySignature.valid(FreedomPaySignature.scriptName(requestPath), params, secretKey)) {
            log.warn("Freedom Pay notification with a wrong signature for order {}", params.get("pg_order_id"));
            return answer("error", "Wrong signature");
        }
        Payment p = payments.findByOrderIdForUpdate(String.valueOf(params.get("pg_order_id"))).orElse(null);
        if (p == null) {
            log.warn("Freedom Pay notification for an unknown order {}", params.get("pg_order_id"));
            return answer("rejected", "Unknown order");
        }
        if (Payment.PAID.equals(p.getStatus())) {
            return answer("ok", "Already processed");
        }
        boolean success = "1".equals(params.get("pg_result"));
        if (!success) {
            p.setStatus(Payment.FAILED);
            payments.save(p);
            return answer("ok", "Noted");
        }
        int paid;
        try {
            paid = (int) Math.round(Double.parseDouble(params.getOrDefault("pg_amount", "0")));
        } catch (NumberFormatException e) {
            paid = -1;
        }
        if (paid != p.getAmount() || !p.getCurrency().equalsIgnoreCase(params.getOrDefault("pg_currency", p.getCurrency()))) {
            log.error("Freedom Pay paid {} {} for order {} that costs {} {}", params.get("pg_amount"),
                    params.get("pg_currency"), p.getOrderId(), p.getAmount(), p.getCurrency());
            return answer("rejected", "Wrong amount");
        }
        p.setStatus(Payment.PAID);
        p.setPaidAt(Instant.now());
        if (params.get("pg_payment_id") != null) {
            p.setProviderPaymentId(params.get("pg_payment_id"));
        }
        payments.save(p);
        User u = access.grant(p.getUserId(), days(p.getPlan()));
        log.info("Payment {} received: teacher mode for user {} until {}", p.getOrderId(), u.getId(), u.getTeacherUntil());
        mail.notifyOwner("PixelCode Arena: paid " + p.getAmount() + " " + p.getCurrency() + (p.isTesting() ? " (TEST)" : ""),
                "Player: " + u.getUsername() + " (id " + u.getId() + ")\nPlan: " + p.getPlan() + "\nOrder: " + p.getOrderId()
                        + "\nFreedom Pay payment: " + p.getProviderPaymentId()
                        + "\nTeacher mode is on until " + u.getTeacherUntil() + ". Nothing to do.");
        return answer("ok", "Accepted");
    }

    /** For the return page: has this order of this user been paid yet? */
    public Map<String, Object> orderStatus(long userId, String orderId) {
        Payment p = payments.findByOrderId(orderId)
                .filter(x -> x.getUserId().equals(userId))
                .orElseThrow(() -> new ApiException(404, "Payment not found"));
        return Map.of("status", p.getStatus(), "plan", p.getPlan());
    }

    public List<Map<String, Object>> recent() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Payment p : payments.findTop100ByOrderByIdDesc()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("orderId", p.getOrderId());
            m.put("username", users.findById(p.getUserId()).map(User::getUsername).orElse("?"));
            m.put("plan", p.getPlan());
            m.put("amount", p.getAmount());
            m.put("currency", p.getCurrency());
            m.put("status", p.getStatus());
            m.put("testing", p.isTesting());
            m.put("createdAt", p.getCreatedAt().toEpochMilli());
            out.add(m);
        }
        return out;
    }

    // ------------------------------------------------------------------ helpers

    private static String salt() {
        String chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 16; i++) {
            sb.append(chars.charAt(RND.nextInt(chars.length())));
        }
        return sb.toString();
    }

    private static String answer(String status, String description) {
        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<response><pg_status>" + status
                + "</pg_status><pg_description>" + description + "</pg_description></response>";
    }

    private Map<String, String> post(String url, Map<String, String> form) {
        StringBuilder body = new StringBuilder();
        for (Map.Entry<String, String> e : form.entrySet()) {
            if (!body.isEmpty()) {
                body.append('&');
            }
            body.append(URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8)).append('=')
                    .append(URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8));
        }
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(20))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                    .build();
            HttpResponse<byte[]> res = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            return parseXml(res.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ApiException(502, "The payment service did not answer, please try again");
        } catch (Exception e) {
            log.error("Freedom Pay request failed: {}", e.getMessage());
            throw new ApiException(502, "The payment service did not answer, please try again");
        }
    }

    /** The flat &lt;response&gt; of the Merchant API as a map of its child elements. */
    static Map<String, String> parseXml(byte[] xml) throws Exception {
        DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
        f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        f.setXIncludeAware(false);
        f.setExpandEntityReferences(false);
        Document doc = f.newDocumentBuilder().parse(new ByteArrayInputStream(xml));
        Map<String, String> out = new TreeMap<>();
        NodeList nodes = doc.getDocumentElement().getChildNodes();
        for (int i = 0; i < nodes.getLength(); i++) {
            Node n = nodes.item(i);
            if (n instanceof Element el) {
                out.put(el.getTagName(), el.getTextContent());
            }
        }
        return out;
    }
}
