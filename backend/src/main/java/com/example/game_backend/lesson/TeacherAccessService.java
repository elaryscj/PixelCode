package com.example.game_backend.lesson;

import com.example.game_backend.entity.TeacherRequest;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.TeacherRequestRepository;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.RateLimiter;
import com.example.game_backend.service.MailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Teacher mode as a product: a free trial once per account, then a paid subscription (a month or a school year).
 * Until online payment is connected, a teacher sends a request, the operator invoices them (e.g. a Kaspi
 * transfer) and switches the access on in /admin; the request also arrives by e-mail.
 */
@Service
public class TeacherAccessService {
    public static final Set<String> PLANS = Set.of("MONTH", "YEAR");

    private final UserRepository users;
    private final TeacherRequestRepository requests;
    private final MailService mail;
    private final RateLimiter limiter;
    private final int trialDays;
    private final int priceMonth;
    private final int priceYear;
    private final String currency;

    public TeacherAccessService(UserRepository users, TeacherRequestRepository requests, MailService mail,
                                RateLimiter limiter,
                                @Value("${game.teacher.trial-days:14}") int trialDays,
                                @Value("${game.teacher.price-month:4990}") int priceMonth,
                                @Value("${game.teacher.price-year:39990}") int priceYear,
                                @Value("${game.teacher.currency:KZT}") String currency) {
        this.users = users;
        this.requests = requests;
        this.mail = mail;
        this.limiter = limiter;
        this.trialDays = trialDays;
        this.priceMonth = priceMonth;
        this.priceYear = priceYear;
        this.currency = currency;
    }

    private User user(long userId) {
        return users.findById(userId).orElseThrow(() -> new ApiException(401, "Please log in again"));
    }

    /** What the teacher page shows: access, end date, trial, prices, a pending request. */
    public Map<String, Object> status(long userId) {
        User u = user(userId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("teacher", u.isTeacher());
        m.put("active", u.hasTeacherAccess());
        m.put("until", u.isTeacher() && u.getTeacherUntil() != null ? u.getTeacherUntil().toEpochMilli() : null);
        m.put("unlimited", u.isTeacher() && u.getTeacherUntil() == null);
        m.put("trialAvailable", !u.isTeacherTrialUsed() && !u.hasTeacherAccess());
        m.put("trialDays", trialDays);
        m.put("priceMonth", priceMonth);
        m.put("priceYear", priceYear);
        m.put("currency", currency);
        m.put("requestPending", requests.existsByUserIdAndStatus(userId, TeacherRequest.NEW));
        return m;
    }

    @Transactional
    public Map<String, Object> startTrial(long userId) {
        User u = user(userId);
        if (u.isTeacherTrialUsed()) {
            throw new ApiException(409, "The free trial has already been used");
        }
        if (u.hasTeacherAccess()) {
            throw new ApiException(409, "Teacher mode is already active");
        }
        u.setTeacher(true);
        u.setTeacherUntil(Instant.now().plus(Duration.ofDays(trialDays)));
        u.setTeacherTrialUsed(true);
        users.save(u);
        return status(userId);
    }

    public Map<String, Object> request(long userId, String plan, String school, String contact, String note) {
        User u = user(userId);
        limiter.hit("teacher-request:" + userId, 5, 3600);
        String p = plan == null ? "" : plan.trim().toUpperCase(Locale.ROOT);
        if (!PLANS.contains(p)) {
            throw new ApiException(400, "Choose a month or a year");
        }
        String sc = clean(school, 120);
        String ct = clean(contact, 120);
        if (sc.isEmpty()) {
            throw new ApiException(400, "Enter your school or course");
        }
        if (ct.isEmpty()) {
            throw new ApiException(400, "Enter a phone number or e-mail to reach you");
        }
        if (requests.existsByUserIdAndStatus(userId, TeacherRequest.NEW)) {
            throw new ApiException(409, "Your request is already waiting for an answer");
        }
        TeacherRequest r = new TeacherRequest();
        r.setUserId(userId);
        r.setPlan(p);
        r.setSchool(sc);
        r.setContact(ct);
        r.setNote(clean(note, 500));
        requests.save(r);
        int price = "YEAR".equals(p) ? priceYear : priceMonth;
        mail.notifyOwner("PixelCode Arena: teacher subscription request (" + p + ")",
                "Player: " + u.getUsername() + " (id " + u.getId() + ")\nPlan: " + p + ", " + price + " " + currency
                        + "\nSchool: " + sc + "\nContact: " + ct + (r.getNote().isEmpty() ? "" : "\nNote: " + r.getNote())
                        + "\n\nAfter the payment, open /admin > TEACHER REQUESTS and switch the access on.");
        return status(userId);
    }

    // ------------------------------------------------------------------ admin

    public List<Map<String, Object>> list() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (TeacherRequest r : requests.findTop100ByOrderByIdDesc()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("userId", r.getUserId());
            m.put("username", users.findById(r.getUserId()).map(User::getUsername).orElse("?"));
            m.put("plan", r.getPlan());
            m.put("school", r.getSchool());
            m.put("contact", r.getContact());
            m.put("note", r.getNote());
            m.put("status", r.getStatus());
            m.put("createdAt", r.getCreatedAt().toEpochMilli());
            out.add(m);
        }
        return out;
    }

    /**
     * Grants teacher mode for `days` more days (added to what is left), forever with days = null,
     * or takes it away with days = 0. Closes the user's open request.
     */
    @Transactional
    public User grant(long userId, Integer days) {
        User u = user(userId);
        if (days != null && days == 0) {
            u.setTeacher(false);
            u.setTeacherUntil(null);
        } else if (days == null) {
            u.setTeacher(true);
            u.setTeacherUntil(null);
        } else {
            if (days < 0 || days > 3660) {
                throw new ApiException(400, "Days must be between 1 and 3660");
            }
            Instant from = u.hasTeacherAccess() && u.getTeacherUntil() != null ? u.getTeacherUntil() : Instant.now();
            u.setTeacher(true);
            u.setTeacherUntil(from.plus(Duration.ofDays(days)));
        }
        users.save(u);
        if (u.isTeacher()) {
            for (TeacherRequest r : requests.findTop100ByOrderByIdDesc()) {
                if (r.getUserId().equals(userId) && TeacherRequest.NEW.equals(r.getStatus())) {
                    r.setStatus(TeacherRequest.DONE);
                    requests.save(r);
                }
            }
        }
        return u;
    }

    public void close(long requestId) {
        TeacherRequest r = requests.findById(requestId).orElseThrow(() -> new ApiException(404, "Request not found"));
        r.setStatus(TeacherRequest.DONE);
        requests.save(r);
    }

    private static String clean(String s, int max) {
        String t = s == null ? "" : s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }
}
