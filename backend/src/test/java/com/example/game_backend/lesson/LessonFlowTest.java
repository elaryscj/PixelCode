package com.example.game_backend.lesson;

import com.example.game_backend.entity.Challenge;
import com.example.game_backend.entity.Lesson;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.game.ChallengeSeeder;
import com.example.game_backend.repository.ChallengeRepository;
import com.example.game_backend.repository.LessonRepository;
import com.example.game_backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** Real PostgreSQL ("pixelcode_test"): a whole lesson, from creating it to the teacher's table. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/pixelcode_test",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "game.limits.register-per-hour=1000",
        "game.limits.api-writes-per-minute=10000",
        "game.limits.api-per-minute=10000",
})
class LessonFlowTest {
    @Autowired LessonService service;
    @Autowired UserRepository users;
    @Autowired ChallengeRepository challenges;
    @Autowired LessonRepository lessons;
    @Autowired TeacherTaskService tasks;
    @Autowired TeacherAccessService access;

    private User newUser(boolean teacher) {
        User u = new User("t" + UUID.randomUUID().toString().substring(0, 8), "x");
        u.setTeacher(teacher);
        return users.save(u);
    }

    /** Four published catalog challenges and their reference solutions, door 1..4. */
    private List<Object[]> fourTasks() {
        Map<String, String> refs = new HashMap<>();
        for (ChallengeSeeder.Entry e : ChallengeSeeder.catalog()) {
            refs.put(e.title(), e.referenceSolution());
        }
        List<Object[]> out = new ArrayList<>();
        for (Challenge c : challenges.findByPublishedTrue()) {
            if (refs.containsKey(c.getTitle()) && out.size() < 4) {
                out.add(new Object[]{c.getId(), refs.get(c.getTitle())});
            }
        }
        assertEquals(4, out.size(), "catalog seeded");
        return out;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> rows(Map<String, Object> board) {
        return (List<Map<String, Object>>) board.get("students");
    }

    @Test
    void wholeLesson() {
        User player = newUser(false);
        User teacher = newUser(true);
        List<Object[]> tasks = fourTasks();
        List<Long> ids = tasks.stream().map(t -> (Long) t[0]).toList();

        // only teachers create lessons, and only valid ones
        assertThrows(ApiException.class, () -> service.create(player.getId(), "Loops", 0, ids, 40));
        assertThrows(ApiException.class, () -> service.create(teacher.getId(), "Loops", 0, ids.subList(0, 3), 40));
        assertThrows(ApiException.class, () -> service.create(teacher.getId(), " ", 0, ids, 40));
        String code = (String) service.create(teacher.getId(), "Loops", 2, ids, 40).get("code");
        assertEquals(6, code.length());
        assertEquals("LOBBY", service.mine(teacher.getId()).get(0).get("status"));

        // students join with a name only
        Map<String, Object> ann = service.join(code, "  Ann ", "1.2.3.4");
        String annToken = (String) ann.get("token");
        assertEquals("Ann", ann.get("name"));
        assertThrows(ApiException.class, () -> service.join(code, "ann", "1.2.3.4")); // name taken
        String bobToken = (String) service.join(code.toLowerCase(), "Bob", "1.2.3.4").get("token");
        assertThrows(ApiException.class, () -> service.me(code, "forged", null));

        // nothing opens before the start; only the owner starts it
        assertThrows(ApiException.class, () -> service.openDoor(code, annToken, 1));
        User other = newUser(true);
        assertThrows(ApiException.class, () -> service.start(other.getId(), code));
        service.start(teacher.getId(), code);
        // skip the 5 s countdown
        Lesson l = lessons.findByCode(code).orElseThrow();
        l.setStartedAt(Instant.now().minusSeconds(1));
        lessons.save(l);

        // Ann: a wrong try, then all four doors in order, then the finish
        assertThrows(ApiException.class, () -> service.openDoor(code, annToken, 2)); // in order
        assertEquals(1, service.openDoor(code, annToken, 1).get("cpNum"));
        Map<String, Object> wrong = service.submit(code, annToken, 1, "class Solution { }");
        assertEquals(false, wrong.get("unlocked"));
        for (int d = 1; d <= 4; d++) {
            if (d > 1) {
                service.openDoor(code, annToken, d);
            }
            sleepPastThrottle();
            Map<String, Object> r = service.submit(code, annToken, d, (String) tasks.get(d - 1)[1]);
            assertEquals(true, r.get("unlocked"), "door " + d + ": " + r);
        }
        assertEquals(true, service.finish(code, annToken).get("finished"));
        assertThrows(ApiException.class, () -> service.openDoor(code, annToken, 1));

        // Bob opened door 1 and is still working on it
        service.openDoor(code, bobToken, 1);
        assertThrows(ApiException.class, () -> service.finish(code, bobToken));

        Map<String, Object> board = service.board(teacher.getId(), code);
        assertThrows(ApiException.class, () -> service.board(other.getId(), code));
        assertEquals(4, ((List<?>) board.get("doors")).size());
        List<Map<String, Object>> rs = rows(board);
        assertEquals("Ann", rs.get(0).get("name"));
        assertEquals(1, rs.get(0).get("place"));
        assertNotNull(rs.get(0).get("finishedSeconds"));
        @SuppressWarnings("unchecked") Map<String, Object> annDoor1 = ((List<Map<String, Object>>) rs.get(0).get("doors")).get(0);
        assertEquals("SOLVED", annDoor1.get("state"));
        assertEquals(2, annDoor1.get("attempts"));
        @SuppressWarnings("unchecked") Map<String, Object> bobDoor1 = ((List<Map<String, Object>>) rs.get(1).get("doors")).get(0);
        assertEquals("WORKING", bobDoor1.get("state"));

        // the teacher reads Ann's code
        long annId = ((Number) rs.get(0).get("id")).longValue();
        @SuppressWarnings("unchecked") List<Map<String, Object>> subs =
                (List<Map<String, Object>>) service.studentWork(teacher.getId(), code, annId).get("submissions");
        assertEquals(5, subs.size());
        assertEquals("class Solution { }", subs.get(0).get("code"));

        // ending: nobody can join or play any more
        service.end(teacher.getId(), code);
        assertEquals("ENDED", service.board(teacher.getId(), code).get("status"));
        assertThrows(ApiException.class, () -> service.join(code, "Cara", "1.2.3.4"));
        assertThrows(ApiException.class, () -> service.submit(code, bobToken, 1, (String) tasks.get(0)[1]));
    }

    private static void sleepPastThrottle() {
        try {
            Thread.sleep(LessonService.SUBMIT_GAP_MS + 50);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @Test
    void teachersOwnTasksArePrivateAndChecked() {
        User teacher = newUser(true);
        User other = newUser(true);
        String tests = "[{\"input\":[2,3],\"expected\":5},{\"input\":[10,-4],\"expected\":6}]";
        String good = "class Solution { public static int solve(int a, int b) { return a + b; } }";
        String title = "Sum for 7B " + UUID.randomUUID().toString().substring(0, 6);
        TeacherTaskService.Form wrong = new TeacherTaskService.Form(title, "EASY", "Add two numbers", null, null,
                "solve", "solve(2, 3) -> 5", tests, "class Solution { public static int solve(int a, int b) { return a - b; } }");
        assertThrows(ApiException.class, () -> tasks.create(teacher.getId(), wrong)); // reference fails a test
        assertThrows(ApiException.class, () -> tasks.create(newUser(false).getId(), wrong)); // not a teacher
        TeacherTaskService.Form ok = new TeacherTaskService.Form(title, "EASY", "Add two numbers", null, null,
                "solve", "solve(2, 3) -> 5", tests, good);
        long id = ((Number) tasks.create(teacher.getId(), ok).get("id")).longValue();
        assertThrows(ApiException.class, () -> tasks.create(teacher.getId(), ok)); // same title again

        // private: never in public matches or in another teacher's list
        assertTrue(challenges.findByPublishedTrue().stream().noneMatch(c -> c.getId() == id));
        assertTrue(service.catalog(other.getId()).stream().noneMatch(m -> ((Number) m.get("id")).longValue() == id));
        Map<String, Object> mineFirst = service.catalog(teacher.getId()).get(0);
        assertEquals(id, ((Number) mineFirst.get("id")).longValue());
        assertEquals(true, mineFirst.get("mine"));
        assertThrows(ApiException.class, () -> tasks.update(other.getId(), id, ok));

        // usable in the owner's lesson, not in someone else's
        List<Long> ids = new ArrayList<>(fourTasks().stream().map(t -> (Long) t[0]).toList());
        ids.set(0, id);
        assertThrows(ApiException.class, () -> service.create(other.getId(), "Theirs", 0, ids, 30));
        String code = (String) service.create(teacher.getId(), "Mine", 0, ids, 30).get("code");
        String token = (String) service.join(code, "Kim", "5.6.7.8").get("token");
        service.start(teacher.getId(), code);
        Lesson l = lessons.findByCode(code).orElseThrow();
        l.setStartedAt(Instant.now().minusSeconds(1));
        lessons.save(l);
        assertEquals(title, service.openDoor(code, token, 1).get("title"));
        assertEquals(true, service.submit(code, token, 1, good).get("unlocked"));

        // editing keeps it checked
        TeacherTaskService.Form edited = new TeacherTaskService.Form(title, "MEDIUM", "Add two whole numbers", null, null,
                "solve", "", tests, good);
        assertEquals("MEDIUM", tasks.update(teacher.getId(), id, edited).get("difficulty"));
        assertEquals(1, tasks.mine(teacher.getId()).size());
    }

    @Test
    void trialRequestSubscriptionAndExpiry() {
        User u = newUser(false);
        List<Long> ids = fourTasks().stream().map(t -> (Long) t[0]).toList();
        assertThrows(ApiException.class, () -> service.create(u.getId(), "No access", 0, ids, 30));
        assertEquals(true, access.status(u.getId()).get("trialAvailable"));

        // the free trial: once, and it works right away
        Map<String, Object> st = access.startTrial(u.getId());
        assertEquals(true, st.get("active"));
        assertEquals(false, st.get("trialAvailable"));
        assertThrows(ApiException.class, () -> access.startTrial(u.getId()));
        String code = (String) service.create(u.getId(), "Trial lesson", 0, ids, 30).get("code");

        // a subscription request (one open at a time)
        assertThrows(ApiException.class, () -> access.request(u.getId(), "WEEK", "School 7", "+7 700 000 00 00", null));
        assertThrows(ApiException.class, () -> access.request(u.getId(), "YEAR", " ", "+7 700 000 00 00", null));
        assertEquals(true, access.request(u.getId(), "YEAR", "School 7", "+7 700 000 00 00", "2 classes").get("requestPending"));
        assertThrows(ApiException.class, () -> access.request(u.getId(), "MONTH", "School 7", "x", null));
        assertTrue(access.list().stream().anyMatch(r -> r.get("userId").equals(u.getId()) && "NEW".equals(r.get("status"))));

        // the admin grants a year on top of the trial; the request is closed
        java.time.Instant trialEnd = users.findById(u.getId()).orElseThrow().getTeacherUntil();
        User granted = access.grant(u.getId(), 365);
        assertTrue(granted.getTeacherUntil().isAfter(trialEnd.plus(java.time.Duration.ofDays(364))));
        assertEquals(false, access.status(u.getId()).get("requestPending"));

        // ran out: no new lessons, but old ones stay readable
        granted.setTeacherUntil(java.time.Instant.now().minusSeconds(60));
        users.save(granted);
        assertEquals(false, access.status(u.getId()).get("active"));
        assertThrows(ApiException.class, () -> service.create(u.getId(), "Late", 0, ids, 30));
        assertThrows(ApiException.class, () -> service.start(u.getId(), code));
        assertEquals("Trial lesson", service.board(u.getId(), code).get("title"));
        assertEquals(1, service.mine(u.getId()).size());

        // renewal after the end counts from now; 0 takes the access away
        assertTrue(access.grant(u.getId(), 30).hasTeacherAccess());
        assertEquals(false, access.grant(u.getId(), 0).isTeacher());
    }
}
