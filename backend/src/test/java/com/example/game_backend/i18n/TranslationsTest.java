package com.example.game_backend.i18n;

import com.example.game_backend.game.ChallengeSeeder;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Every language has every server message and every built-in challenge text. */
class TranslationsTest {
    private static final List<String> LANGS = Lang.SUPPORTED.stream().filter(l -> !l.equals("en")).toList();
    /** admin-only screens stay English (see STATUS.md) */
    private static final Set<String> ADMIN_ONLY = Set.of(
            "Amount must be a whole number", "Balance must stay between 0 and 100,000,000", "Challenge not found",
            "Difficulty must be EASY, MEDIUM or HARD", "Function name is not a valid identifier",
            "Item name must be 2-40 characters", "Price must be a whole number", "Price must be between 0 and 1,000,000",
            "Unknown action");
    private static final Pattern PH = Pattern.compile("\\{\\d}");

    private static Set<String> placeholders(String s) {
        Set<String> out = new TreeSet<>();
        Matcher m = PH.matcher(s);
        while (m.find()) {
            out.add(m.group());
        }
        return out;
    }

    @Test
    void everyLanguageHasTheSameServerMessages() {
        Set<String> reference = ServerText.entries("ru").keySet();
        assertTrue(reference.size() > 80, "server messages missing");
        for (String lang : LANGS) {
            Map<String, String> table = ServerText.entries(lang);
            assertEquals(reference, table.keySet(), lang + ": keys differ");
            table.forEach((k, v) -> {
                assertEquals(placeholders(k), placeholders(v), lang + ": placeholders of " + k);
                assertTrue(!v.isBlank(), lang + ": empty translation of " + k);
            });
        }
    }

    @Test
    void everyFixedPlayerFacingErrorIsTranslated() throws IOException {
        Pattern literal = Pattern.compile("new ApiException\\(\\d+, \"([^\"]+)\"\\)");
        Set<String> keys = ServerText.entries("ru").keySet();
        List<String> missing = new ArrayList<>();
        try (Stream<Path> files = Files.walk(Path.of("src/main/java"))) {
            for (Path p : files.filter(f -> f.toString().endsWith(".java")).toList()) {
                Matcher m = literal.matcher(Files.readString(p));
                while (m.find()) {
                    String msg = m.group(1);
                    if (!keys.contains(msg) && !ADMIN_ONLY.contains(msg)) {
                        missing.add(msg + " (" + p.getFileName() + ")");
                    }
                }
            }
        }
        assertTrue(missing.isEmpty(), "no translation for: " + missing);
    }

    @Test
    void templatesFillInTheChangingParts() {
        assertEquals("Слишком много попыток. Повторите через 5 мин", ServerText.tr("Too many attempts. Try again in 5 min", "ru"));
        assertEquals("Вы уже в матче (ABC123)", ServerText.tr("You are already in a match (ABC123)", "ru"));
        // a known message inside a template is translated as well
        assertEquals("Строка 3: Уберите строку 'package': пишите просто class Solution { ... }",
                ServerText.tr("Line 3: Remove the 'package' line: write just class Solution { ... }", "ru"));
        // the more specific template wins
        assertEquals("Thread.sleep() запрещён (без потоков)", ServerText.tr("Thread.sleep() is not allowed (no threads)", "ru"));
        // javac's own text stays as it is
        assertEquals("Строка 2: cannot find symbol", ServerText.tr("Line 2: cannot find symbol", "ru"));
        assertEquals("Room not found", ServerText.tr("Room not found", "en"));
        assertEquals("Something new", ServerText.tr("Something new", "de"));
    }

    @Test
    void acceptLanguageHeaders() {
        assertEquals("ru", Lang.of("ru"));
        assertEquals("ru", Lang.of("ru-RU,ru;q=0.9,en;q=0.8"));
        assertEquals("kz", Lang.of("kk-KZ"));
        assertEquals("kz", Lang.of("kz"));
        assertEquals("en", Lang.of("sv-SE"));
        assertEquals("de", Lang.of("sv-SE, de;q=0.5"));
        assertEquals("en", Lang.of(null));
    }

    @Test
    void everyLanguageHasEveryChallengeText() {
        List<ChallengeSeeder.Entry> catalog = ChallengeSeeder.catalog();
        for (String lang : LANGS) {
            Map<String, ChallengeText.Entry> table = ChallengeText.entries(lang);
            assertEquals(catalog.size(), table.size(), lang);
            for (ChallengeSeeder.Entry e : catalog) {
                ChallengeText.Entry t = table.get(e.title());
                assertTrue(t != null, lang + ": no text for " + e.title());
                assertTrue(t.description().contains("`solve("), lang + ": method name lost in " + e.title());
            }
        }
    }

    @Test
    void anEditedChallengeKeepsTheAdminsText() {
        ChallengeSeeder.Entry first = ChallengeSeeder.catalog().get(0);
        Map<String, Object> view = new java.util.HashMap<>(Map.of("title", first.title(), "description", first.description()));
        ChallengeText.localize(view, "ru");
        assertTrue(view.get("description").toString().startsWith("Напишите"));

        Map<String, Object> edited = new java.util.HashMap<>(Map.of("title", first.title(), "description", "Changed by an admin"));
        ChallengeText.localize(edited, "ru");
        assertEquals("Changed by an admin", edited.get("description"));
    }
}
