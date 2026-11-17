package com.example.game_backend.i18n;

import com.example.game_backend.game.ChallengeSeeder;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Translated texts of the built-in challenges: resources/i18n/challenges/<lang>.json, keyed by the challenge
 * title (titles stay English, like the code). Challenges an admin adds, or edits so the text no longer
 * matches, are shown as written.
 */
public final class ChallengeText {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Map<String, Map<String, Entry>> CACHE = new ConcurrentHashMap<>();
    /** English description of each catalog challenge: a translation is used only while the text is unchanged. */
    private static volatile Map<String, String> original;

    public record Entry(String description, String inputDescription, String outputDescription) {
    }

    private ChallengeText() {
    }

    public static Map<String, Entry> entries(String lang) {
        return CACHE.computeIfAbsent(lang, ChallengeText::load);
    }

    /** Replaces description / input / output in a challenge view (keys as sent to the game screen). */
    public static void localize(Map<String, Object> view, String lang) {
        if (Lang.DEFAULT.equals(lang) || !(view.get("title") instanceof String title)) {
            return;
        }
        Entry e = entries(lang).get(title);
        if (e == null || !String.valueOf(view.get("description")).equals(originals().get(title))) {
            return;
        }
        view.put("description", e.description());
        view.put("inputDescription", e.inputDescription());
        view.put("outputDescription", e.outputDescription());
    }

    private static Map<String, String> originals() {
        Map<String, String> m = original;
        if (m == null) {
            m = new ConcurrentHashMap<>();
            for (ChallengeSeeder.Entry c : ChallengeSeeder.catalog()) {
                m.put(c.title(), c.description());
            }
            original = m;
        }
        return m;
    }

    private static Map<String, Entry> load(String lang) {
        try (InputStream in = ChallengeText.class.getResourceAsStream("/i18n/challenges/" + lang + ".json")) {
            if (in == null) {
                return Map.of();
            }
            return JSON.readValue(in, new TypeReference<Map<String, Entry>>() { });
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read challenge translations for " + lang, e);
        }
    }
}
