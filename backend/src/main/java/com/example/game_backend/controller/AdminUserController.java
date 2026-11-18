package com.example.game_backend.controller;

import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.AdminAccess;
import com.example.game_backend.security.TokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/** Administrators look players up, change their PIXELS balance and make them teachers. */
@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {
    private final UserRepository users;
    private final TokenService tokens;
    private final AdminAccess admins;
    private final com.example.game_backend.lesson.TeacherAccessService teacherAccess;

    public AdminUserController(UserRepository users, TokenService tokens, AdminAccess admins,
                               com.example.game_backend.lesson.TeacherAccessService teacherAccess) {
        this.admins = admins;
        this.teacherAccess = teacherAccess;
        this.users = users;
        this.tokens = tokens;
    }

    private void requireAdmin(String auth) {
        admins.require(auth);
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> search(@RequestParam(defaultValue = "") String q,
                                                            @RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        String needle = q.trim().toLowerCase();
        List<Map<String, Object>> out = new ArrayList<>();
        for (User u : users.findTop50ByBotFalseOrderByRatingDescIdAsc()) {
            if (needle.isEmpty() || u.getUsername().toLowerCase().contains(needle)) out.add(view(u));
        }
        if (!needle.isEmpty()) {
            users.findByUsernameIgnoreCase(needle).ifPresent(u -> {
                if (out.stream().noneMatch(m -> m.get("id").equals(u.getId()))) out.add(0, view(u));
            });
        }
        return ResponseEntity.ok(out);
    }

    /** body: {"mode":"set"|"add", "amount": 500}  (add accepts negative numbers) */
    @PostMapping("/{id}/balance")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Map<String, Object>> balance(@PathVariable long id, @RequestBody Map<String, Object> body,
                                                       @RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        User u = users.findByIdForUpdate(id).orElseThrow(() -> new ApiException(404, "Player not found"));
        long amount;
        try {
            amount = Long.parseLong(String.valueOf(body.get("amount")).trim());
        } catch (NumberFormatException e) {
            throw new ApiException(400, "Amount must be a whole number");
        }
        boolean set = "set".equals(String.valueOf(body.get("mode")));
        long next = set ? amount : (long) u.getPixels() + amount;
        if (next < 0 || next > 100_000_000L) {
            throw new ApiException(400, "Balance must stay between 0 and 100,000,000");
        }
        u.setPixels((int) next);
        return ResponseEntity.ok(view(users.save(u)));
    }

    /**
     * Teacher mode (lessons). body: {"days": 30} adds 30 days to the subscription (renewal), {"days": null} or
     * {"teacher": true} without days = no end date, {"days": 0} or {"teacher": false} takes it away.
     */
    @PostMapping("/{id}/teacher")
    public ResponseEntity<Map<String, Object>> teacher(@PathVariable long id, @RequestBody Map<String, Object> body,
                                                       @RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        users.findById(id).orElseThrow(() -> new ApiException(404, "Player not found"));
        Integer days;
        if (Boolean.FALSE.equals(body.get("teacher"))) {
            days = 0;
        } else if (body.get("days") instanceof Number n) {
            days = n.intValue();
        } else {
            days = null;
        }
        return ResponseEntity.ok(view(teacherAccess.grant(id, days)));
    }

    /** Teachers' subscription requests, newest first. */
    @GetMapping("/teacher-requests")
    public ResponseEntity<List<Map<String, Object>>> teacherRequests(@RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        return ResponseEntity.ok(teacherAccess.list());
    }

    @PostMapping("/teacher-requests/{requestId}/close")
    public ResponseEntity<Void> closeTeacherRequest(@PathVariable long requestId,
                                                    @RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        teacherAccess.close(requestId);
        return ResponseEntity.noContent().build();
    }

    private static Map<String, Object> view(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("username", u.getUsername());
        m.put("rating", u.getRating());
        m.put("pixels", u.getPixels());
        m.put("teacher", u.isTeacher());
        m.put("teacherActive", u.hasTeacherAccess());
        m.put("teacherUntil", u.isTeacher() && u.getTeacherUntil() != null ? u.getTeacherUntil().toEpochMilli() : null);
        return m;
    }
}
