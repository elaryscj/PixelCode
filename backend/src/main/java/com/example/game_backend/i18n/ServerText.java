package com.example.game_backend.i18n;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Translates messages the server shows to players (errors, checker feedback). The English text is the key:
 * resources/i18n/server/<lang>.json maps it to the translation. Messages with changing parts are written as
 * templates ("Room {0} is full"); the parts are translated too when they are known messages themselves
 * ("Line 3: Write some code first"). Anything without a translation stays English.
 */
public final class ServerText {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{(\\d)}");
    private static final Map<String, Table> TABLES = new ConcurrentHashMap<>();

    private ServerText() {
    }

    private record Template(Pattern pattern, String translation, int literalLength) {
    }

    private record Table(Map<String, String> exact, List<Template> templates) {
    }

    /** The message in the current request's language. */
    public static String tr(String english) {
        return tr(english, Lang.current());
    }

    public static String tr(String english, String lang) {
        if (english == null || lang == null || Lang.DEFAULT.equals(lang)) {
            return english;
        }
        Table table = TABLES.computeIfAbsent(lang, ServerText::load);
        return translate(english, table, 0);
    }

    private static String translate(String text, Table table, int depth) {
        String exact = table.exact.get(text);
        if (exact != null) {
            return exact;
        }
        if (depth > 2) {
            return text;
        }
        for (Template t : table.templates) {
            Matcher m = t.pattern.matcher(text);
            if (!m.matches()) {
                continue;
            }
            StringBuilder out = new StringBuilder();
            Matcher ph = PLACEHOLDER.matcher(t.translation);
            while (ph.find()) {
                int group = Integer.parseInt(ph.group(1)) + 1;
                String part = group <= m.groupCount() ? m.group(group) : "";
                ph.appendReplacement(out, Matcher.quoteReplacement(translate(part, table, depth + 1)));
            }
            ph.appendTail(out);
            return out.toString();
        }
        return text;
    }

    /** All English keys with their translations for one language (used by tests). */
    public static Map<String, String> entries(String lang) {
        return read(lang);
    }

    private static Map<String, String> read(String lang) {
        try (InputStream in = ServerText.class.getResourceAsStream("/i18n/server/" + lang + ".json")) {
            if (in == null) {
                return Map.of();
            }
            return JSON.readValue(in, new TypeReference<Map<String, String>>() { });
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read server translations for " + lang, e);
        }
    }

    private static Table load(String lang) {
        Map<String, String> exact = new ConcurrentHashMap<>();
        List<Template> templates = new ArrayList<>();
        for (Map.Entry<String, String> e : read(lang).entrySet()) {
            String key = e.getKey();
            if (!PLACEHOLDER.matcher(key).find()) {
                exact.put(key, e.getValue());
                continue;
            }
            StringBuilder regex = new StringBuilder();
            Matcher ph = PLACEHOLDER.matcher(key);
            int last = 0;
            int literal = 0;
            while (ph.find()) {
                regex.append(Pattern.quote(key.substring(last, ph.start()))).append("(.+?)");
                literal += ph.start() - last;
                last = ph.end();
            }
            regex.append(Pattern.quote(key.substring(last)));
            literal += key.length() - last;
            templates.add(new Template(Pattern.compile(regex.toString(), Pattern.DOTALL), e.getValue(), literal));
        }
        // most specific first: "{0}() is not allowed (no threads)" before "{0}() is not allowed"
        templates.sort(Comparator.comparingInt(Template::literalLength).reversed());
        return new Table(exact, templates);
    }
}
