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
}
