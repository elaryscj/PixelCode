package com.example.game_backend.lesson;

import com.example.game_backend.entity.Challenge;
import com.example.game_backend.entity.Lesson;
import com.example.game_backend.entity.LessonStudent;
import com.example.game_backend.entity.LessonSubmission;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.game.ChallengeEvaluator;
import com.example.game_backend.game.EvalResult;
import com.example.game_backend.game.GameSession;
import com.example.game_backend.repository.ChallengeRepository;
import com.example.game_backend.repository.LessonRepository;
import com.example.game_backend.repository.LessonStudentRepository;
import com.example.game_backend.repository.LessonSubmissionRepository;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.RateLimiter;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Teacher mode. A teacher (flag set by an admin) creates a lesson: a map, four challenges (door 1..4) and a
 * length. Students join with the code and just a name, then everyone runs the same map at the same time,
 * each on their own; a door opens only with an accepted solution (no 4-minute auto-open in a lesson).
 * The teacher's table shows who solved what, how many attempts it took, who is stuck, and every submission.
 */
@Service
public class LessonService {
    static final int MAX_STUDENTS = 60;
    static final long START_COUNTDOWN_MS = 5000;
    static final long STUCK_MS = 3 * 60_000;
    static final long ONLINE_MS = 20_000;
    private static final int MAX_SOURCE_CHARS = 20_000;
    static final long SUBMIT_GAP_MS = 1500;
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
    private static final SecureRandom RND = new SecureRandom();

    private final LessonRepository lessons;
    private final LessonStudentRepository students;
    private final LessonSubmissionRepository submissions;
    private final ChallengeRepository challenges;
    private final UserRepository users;
    private final ChallengeEvaluator evaluator;
    private final RateLimiter limiter;
    /** last submission per student, so one student cannot flood the Java checker */
    private final Map<Long, Long> lastSubmit = new ConcurrentHashMap<>();

    public LessonService(LessonRepository lessons, LessonStudentRepository students, LessonSubmissionRepository submissions,
                         ChallengeRepository challenges, UserRepository users, ChallengeEvaluator evaluator,
                         RateLimiter limiter) {
        this.lessons = lessons;
        this.students = students;
        this.submissions = submissions;
        this.challenges = challenges;
        this.users = users;
        this.evaluator = evaluator;
        this.limiter = limiter;
    }

    // ------------------------------------------------------------------ teacher

    User requireTeacher(long userId) {
        User u = users.findById(userId).orElseThrow(() -> new ApiException(401, "Please log in again"));
        if (!u.isTeacher()) {
            throw new ApiException(403, "Teacher mode is not enabled for this account");
        }
        return u;
    }

    /** Published challenges a teacher can put on the doors. */
    public List<Map<String, Object>> catalog(long userId) {
        requireTeacher(userId);
        List<Map<String, Object>> out = new ArrayList<>();
        List<Challenge> all = new ArrayList<>(challenges.findByPublishedTrue());
        all.sort(Comparator.comparing((Challenge c) -> difficultyRank(c.getDifficulty())).thenComparing(Challenge::getId));
        for (Challenge c : all) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId());
            m.put("title", c.getTitle());
            m.put("difficulty", c.getDifficulty());
            m.put("description", c.getDescription());
            out.add(m);
        }
        return out;
    }

    private static int difficultyRank(String d) {
        return "HARD".equals(d) ? 2 : "MEDIUM".equals(d) ? 1 : 0;
    }

    public Map<String, Object> create(long userId, String title, Integer mapId, List<Long> challengeIds, Integer minutes) {
        requireTeacher(userId);
        limiter.hit("lesson-create:" + userId, 30, 3600);
        String t = title == null ? "" : title.trim();
        if (t.isEmpty() || t.length() > 60) {
            throw new ApiException(400, "Give the lesson a title (up to 60 characters)");
        }
        if (mapId == null || mapId < 0 || mapId >= GameSession.MAP_COUNT) {
            throw new ApiException(400, "Choose a map");
        }
        if (challengeIds == null || challengeIds.size() != GameSession.DOORS) {
            throw new ApiException(400, "Choose four tasks, one for each door");
        }
        for (Long id : challengeIds) {
            Challenge c = id == null ? null : challenges.findById(id).orElse(null);
            if (c == null || !c.isPublished()) {
                throw new ApiException(400, "Choose four tasks, one for each door");
            }
        }
        int len = minutes == null ? 40 : minutes;
        if (len < 5 || len > 180) {
            throw new ApiException(400, "A lesson lasts 5 to 180 minutes");
        }
        Lesson l = new Lesson();
        l.setCode(newCode());
        l.setTeacherId(userId);
        l.setTitle(t);
        l.setMapId(mapId);
        l.setChallengeIds(String.join(",", challengeIds.stream().map(String::valueOf).toList()));
        l.setDurationMinutes(len);
        return summary(lessons.save(l));
    }

    private String newCode() {
        for (int i = 0; i < 20; i++) {
            StringBuilder sb = new StringBuilder();
            for (int k = 0; k < 6; k++) {
                sb.append(CODE_CHARS.charAt(RND.nextInt(CODE_CHARS.length())));
            }
            if (!lessons.existsByCode(sb.toString())) {
                return sb.toString();
            }
        }
        throw new ApiException(503, "Could not create a lesson, please try again");
    }

    public List<Map<String, Object>> mine(long userId) {
        requireTeacher(userId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Lesson l : lessons.findTop50ByTeacherIdOrderByCreatedAtDesc(userId)) {
            Map<String, Object> m = summary(l);
            m.put("students", students.countByLessonId(l.getId()));
            out.add(m);
        }
        return out;
    }

    private Lesson ownLesson(long userId, String code) {
        requireTeacher(userId);
        Lesson l = lesson(code);
        if (!l.getTeacherId().equals(userId)) {
            throw new ApiException(403, "This is not your lesson");
        }
        return l;
    }

    public Map<String, Object> start(long userId, String code) {
        Lesson l = ownLesson(userId, code);
        if (!Lesson.LOBBY.equals(status(l))) {
            throw new ApiException(409, "The lesson has already started");
        }
        Instant start = Instant.now().plusMillis(START_COUNTDOWN_MS);
        l.setStartedAt(start);
        l.setEndsAt(start.plusSeconds(l.getDurationMinutes() * 60L));
        l.setStatus(Lesson.RUNNING);
        return summary(lessons.save(l));
    }

    public Map<String, Object> end(long userId, String code) {
        Lesson l = ownLesson(userId, code);
        if (!Lesson.ENDED.equals(status(l))) {
            l.setStatus(Lesson.ENDED);
            Instant now = Instant.now();
            if (l.getEndsAt() == null || l.getEndsAt().isAfter(now)) {
                l.setEndsAt(now);
            }
            lessons.save(l);
        }
        return summary(l);
    }

    /** The live table: one row per student, ranked (finished first by time, then by doors and speed). */
    public Map<String, Object> board(long userId, String code) {
        Lesson l = ownLesson(userId, code);
        long now = System.currentTimeMillis();
        List<Challenge> doors = doorChallenges(l);
        Map<Long, int[]> attempts = new HashMap<>(); // student -> attempts per door 1..4
        for (LessonSubmission s : submissions.findByLessonId(l.getId())) {
            attempts.computeIfAbsent(s.getStudentId(), k -> new int[GameSession.DOORS + 1])[s.getDoor()]++;
        }
        long start = l.getStartedAt() == null ? 0 : l.getStartedAt().toEpochMilli();
        long end = l.getEndsAt() == null ? now : Math.min(now, l.getEndsAt().toEpochMilli());
        List<Map<String, Object>> rows = new ArrayList<>();
        for (LessonStudent st : students.findByLessonIdOrderByIdAsc(l.getId())) {
            long[] opened = times(st.getOpenedAt());
            long[] solved = times(st.getSolvedAt());
            int[] att = attempts.getOrDefault(st.getId(), new int[GameSession.DOORS + 1]);
            List<Map<String, Object>> ds = new ArrayList<>();
            for (int d = 1; d <= GameSession.DOORS; d++) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("door", d);
                m.put("attempts", att[d]);
                if (solved[d] > 0) {
                    m.put("state", "SOLVED");
                    m.put("seconds", Math.max(0, (solved[d] - Math.max(opened[d], start)) / 1000));
                    m.put("atSecond", Math.max(0, (solved[d] - start) / 1000));
                } else if (opened[d] > 0) {
                    long spent = end - opened[d];
                    m.put("state", spent > STUCK_MS ? "STUCK" : "WORKING");
                    m.put("seconds", Math.max(0, spent / 1000));
                } else {
                    m.put("state", "LOCKED");
                }
                ds.add(m);
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", st.getId());
            row.put("name", st.getName());
            row.put("unlocked", st.getUnlocked());
            row.put("finishedSeconds", st.getFinishedAt() == null ? null
                    : Math.max(0, (st.getFinishedAt().toEpochMilli() - start) / 1000));
            row.put("online", st.getLastSeenAt() != null && now - st.getLastSeenAt().toEpochMilli() < ONLINE_MS);
            row.put("falls", st.getFalls());
            row.put("doors", ds);
            row.put("lastSolvedAt", lastSolved(solved));
            rows.add(row);
        }
        rows.sort((a, b) -> {
            Long fa = (Long) a.get("finishedSeconds");
            Long fb = (Long) b.get("finishedSeconds");
            if (fa != null || fb != null) {
                return fa == null ? 1 : fb == null ? -1 : Long.compare(fa, fb);
            }
            int c = Integer.compare((int) b.get("unlocked"), (int) a.get("unlocked"));
            return c != 0 ? c : Long.compare((long) a.get("lastSolvedAt"), (long) b.get("lastSolvedAt"));
        });
        for (int i = 0; i < rows.size(); i++) {
            rows.get(i).remove("lastSolvedAt");
            rows.get(i).put("place", i + 1);
        }
        Map<String, Object> out = summary(l);
        List<Map<String, Object>> titles = new ArrayList<>();
        for (Challenge c : doors) {
            titles.add(Map.of("id", c.getId(), "title", c.getTitle(), "difficulty", c.getDifficulty()));
        }
        out.put("doors", titles);
        out.put("students", rows);
        out.put("serverTime", now);
        return out;
    }

    private static long lastSolved(long[] solved) {
        long m = 0;
        for (long s : solved) {
            m = Math.max(m, s);
        }
        return m == 0 ? Long.MAX_VALUE : m;
    }

    /** Every attempt one student made, with the code, for the teacher. */
    public Map<String, Object> studentWork(long userId, String code, long studentId) {
        Lesson l = ownLesson(userId, code);
        LessonStudent st = students.findById(studentId)
                .filter(s -> s.getLessonId().equals(l.getId()))
                .orElseThrow(() -> new ApiException(404, "Student not found"));
        long start = l.getStartedAt() == null ? 0 : l.getStartedAt().toEpochMilli();
        List<Map<String, Object>> list = new ArrayList<>();
        for (LessonSubmission s : submissions.findByStudentIdOrderByIdAsc(st.getId())) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("door", s.getDoor());
            m.put("passed", s.isPassed());
            m.put("passedCount", s.getPassedCount());
            m.put("total", s.getTotal());
            m.put("error", s.getError());
            m.put("atSecond", Math.max(0, (s.getAt().toEpochMilli() - start) / 1000));
            m.put("code", s.getCode());
            list.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", st.getId());
        out.put("name", st.getName());
        out.put("submissions", list);
        return out;
    }

    // ------------------------------------------------------------------ students

    /** Joining needs only the lesson code and a name; the returned token identifies the student from then on. */
    public Map<String, Object> join(String code, String rawName, String ip) {
        limiter.hit("lesson-join:" + ip, 120, 600); // a whole class shares one school address
        Lesson l = lesson(code);
        if (Lesson.ENDED.equals(status(l))) {
            throw new ApiException(409, "This lesson has ended");
        }
        String name = rawName == null ? "" : rawName.trim().replaceAll("\\s+", " ");
        if (name.isEmpty() || name.length() > 24) {
            throw new ApiException(400, "Enter your name (up to 24 characters)");
        }
        if (students.countByLessonId(l.getId()) >= MAX_STUDENTS) {
            throw new ApiException(409, "The lesson is full");
        }
        if (students.existsByLessonIdAndNameIgnoreCase(l.getId(), name)) {
            throw new ApiException(409, "Someone in this lesson already uses this name");
        }
        byte[] raw = new byte[24];
        RND.nextBytes(raw);
        String token = HexFormat.of().formatHex(raw);
        LessonStudent st = new LessonStudent();
        st.setLessonId(l.getId());
        st.setName(name);
        st.setTokenHash(hash(token));
        st.setLastSeenAt(Instant.now());
        students.save(st);
        Map<String, Object> out = studentState(l, st);
        out.put("token", token);
        return out;
    }

    /** The student's view; also their heartbeat (polled every few seconds). */
    public Map<String, Object> me(String code, String token, Integer falls) {
        Lesson l = lesson(code);
        LessonStudent st = student(l, token);
        st.setLastSeenAt(Instant.now());
        if (falls != null && falls >= st.getFalls() && falls < 100_000) {
            st.setFalls(falls);
        }
        students.save(st);
        return studentState(l, st);
    }

    public Map<String, Object> openDoor(String code, String token, int door) {
        Lesson l = lesson(code);
        LessonStudent st = student(l, token);
        requirePlaying(l, st);
        if (door != st.getUnlocked() + 1) {
            throw new ApiException(409, door <= st.getUnlocked() ? "This door is already open" : "Open the previous door first");
        }
        long[] opened = times(st.getOpenedAt());
        if (opened[door] == 0) {
            opened[door] = System.currentTimeMillis();
            st.setOpenedAt(join(opened));
        }
        st.setLastSeenAt(Instant.now());
        students.save(st);
        Challenge c = doorChallenges(l).get(door - 1);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("cpNum", door);
        m.put("title", c.getTitle());
        m.put("difficulty", c.getDifficulty());
        m.put("description", c.getDescription());
        m.put("inputDescription", c.getInputDescription());
        m.put("outputDescription", c.getOutputDescription());
        m.put("functionName", c.getFunctionName());
        m.put("initialCode", c.getStarterCode());
        m.put("examples", c.getExamples() == null ? List.of() : List.of(c.getExamples().split("\n")));
        m.put("secondsRemaining", secondsLeft(l));
        return m;
    }

    public Map<String, Object> submit(String code, String token, int door, String source) {
        if (source == null || source.isBlank()) {
            throw new ApiException(400, "Write some code first");
        }
        if (source.length() > MAX_SOURCE_CHARS) {
            throw new ApiException(400, "Solution is too long");
        }
        Lesson l = lesson(code);
        LessonStudent st = student(l, token);
        requirePlaying(l, st);
        if (door != st.getUnlocked() + 1) {
            throw new ApiException(409, door <= st.getUnlocked() ? "This door is already open" : "Open the previous door first");
        }
        if (times(st.getOpenedAt())[door] == 0) {
            throw new ApiException(409, "Open the door first");
        }
        long now = System.currentTimeMillis();
        Long prev = lastSubmit.put(st.getId(), now);
        if (prev != null && now - prev < SUBMIT_GAP_MS) {
            throw new ApiException(429, "Slow down: wait a second between submissions");
        }
        Challenge c = doorChallenges(l).get(door - 1);
        EvalResult r = evaluator.evaluate(source, c.getFunctionName(), c.getTestsJson());
        submissions.save(new LessonSubmission(l.getId(), st.getId(), door, source, r.passed, r.passedCount, r.total, r.errorMessage));

        // re-read: the student may have solved it in another tab meanwhile
        LessonStudent fresh = students.findById(st.getId()).orElse(st);
        if (r.passed && fresh.getUnlocked() == door - 1) {
            long[] solved = times(fresh.getSolvedAt());
            solved[door] = System.currentTimeMillis();
            fresh.setSolvedAt(join(solved));
            fresh.setUnlocked(door);
        }
        fresh.setLastSeenAt(Instant.now());
        students.save(fresh);
        Map<String, Object> m = r.toMap();
        m.put("unlocked", fresh.getUnlocked() >= door);
        m.put("matchOver", false);
        m.put("secondsRemaining", secondsLeft(l));
        return m;
    }

    public Map<String, Object> finish(String code, String token) {
        Lesson l = lesson(code);
        LessonStudent st = student(l, token);
        requirePlaying(l, st);
        if (st.getUnlocked() < GameSession.DOORS) {
            throw new ApiException(409, "Open all four doors first");
        }
        if (st.getFinishedAt() == null) {
            st.setFinishedAt(Instant.now());
            students.save(st);
        }
        return studentState(l, st);
    }

    // ------------------------------------------------------------------ helpers

    private void requirePlaying(Lesson l, LessonStudent st) {
        String s = status(l);
        if (Lesson.LOBBY.equals(s) || Instant.now().isBefore(l.getStartedAt())) {
            throw new ApiException(409, "The lesson has not started yet");
        }
        if (Lesson.ENDED.equals(s)) {
            throw new ApiException(409, "This lesson has ended");
        }
        if (st.getFinishedAt() != null) {
            throw new ApiException(409, "You have already finished");
        }
    }

    /** RUNNING turns into ENDED by itself when the time is up. */
    static String status(Lesson l) {
        if (Lesson.RUNNING.equals(l.getStatus()) && l.getEndsAt() != null && Instant.now().isAfter(l.getEndsAt())) {
            return Lesson.ENDED;
        }
        return l.getStatus();
    }

    private static long secondsLeft(Lesson l) {
        if (l.getEndsAt() == null) {
            return (long) l.getDurationMinutes() * 60;
        }
        return Math.max(0, (l.getEndsAt().toEpochMilli() - System.currentTimeMillis()) / 1000);
    }

    private Lesson lesson(String code) {
        String c = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        return lessons.findByCode(c).orElseThrow(() -> new ApiException(404, "Lesson not found"));
    }

    private LessonStudent student(Lesson l, String token) {
        if (token == null || token.isBlank()) {
            throw new ApiException(403, "Join the lesson first");
        }
        return students.findByTokenHash(hash(token.trim()))
                .filter(s -> s.getLessonId().equals(l.getId()))
                .orElseThrow(() -> new ApiException(403, "Join the lesson first"));
    }

    private List<Challenge> doorChallenges(Lesson l) {
        List<Challenge> out = new ArrayList<>();
        for (String id : l.getChallengeIds().split(",")) {
            out.add(challenges.findById(Long.parseLong(id.trim()))
                    .orElseThrow(() -> new ApiException(409, "A task of this lesson was deleted")));
        }
        return out;
    }

    private Map<String, Object> summary(Lesson l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", l.getCode());
        m.put("title", l.getTitle());
        m.put("mapId", l.getMapId());
        m.put("durationMinutes", l.getDurationMinutes());
        m.put("status", status(l));
        m.put("createdAt", l.getCreatedAt().toEpochMilli());
        m.put("startsAt", l.getStartedAt() == null ? null : l.getStartedAt().toEpochMilli());
        m.put("endsAt", l.getEndsAt() == null ? null : l.getEndsAt().toEpochMilli());
        m.put("serverTime", System.currentTimeMillis());
        return m;
    }

    private Map<String, Object> studentState(Lesson l, LessonStudent st) {
        Map<String, Object> m = summary(l);
        m.put("name", st.getName());
        m.put("unlocked", st.getUnlocked());
        m.put("finished", st.getFinishedAt() != null);
        long start = l.getStartedAt() == null ? 0 : l.getStartedAt().toEpochMilli();
        m.put("finishedSeconds", st.getFinishedAt() == null ? null : Math.max(0, (st.getFinishedAt().toEpochMilli() - start) / 1000));
        return m;
    }

    static long[] times(String csv) {
        long[] out = new long[GameSession.DOORS + 1];
        String[] parts = (csv == null ? "" : csv).split(",", -1);
        for (int i = 0; i < GameSession.DOORS && i < parts.length; i++) {
            out[i + 1] = parts[i].isBlank() ? 0 : Long.parseLong(parts[i].trim());
        }
        return out;
    }

    static String join(long[] t) {
        StringBuilder sb = new StringBuilder();
        for (int i = 1; i <= GameSession.DOORS; i++) {
            if (i > 1) {
                sb.append(',');
            }
            if (t[i] > 0) {
                sb.append(t[i]);
            }
        }
        return sb.toString();
    }

    static String hash(String token) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
