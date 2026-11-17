package com.example.game_backend.i18n;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.Locale;

/** The player's interface language, sent by the frontend as Accept-Language (one of the game's 14 codes). */
public final class Lang {
    public static final String DEFAULT = "en";
    /** Same codes as frontend/app/language-config/languages.ts. */
    public static final List<String> SUPPORTED =
            List.of("en", "kz", "ru", "es", "fr", "de", "pt", "id", "zh", "ja", "ko", "hi", "ar", "ur");

    private Lang() {
    }

    /** Language of the current HTTP request, "en" outside a request or for anything unknown. */
    public static String current() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) {
            return DEFAULT;
        }
        HttpServletRequest request = attrs.getRequest();
        return of(request.getHeader("Accept-Language"));
    }

    /** "ru", "ru-RU,ru;q=0.9", "kk" (Kazakh) -> a supported code; anything else -> "en". */
    public static String of(String header) {
        if (header == null || header.isBlank()) {
            return DEFAULT;
        }
        for (String part : header.split(",")) {
            String tag = part.split(";")[0].trim().toLowerCase(Locale.ROOT);
            String primary = tag.split("[-_]")[0];
            if ("kk".equals(primary)) {
                primary = "kz";
            }
            if (SUPPORTED.contains(primary)) {
                return primary;
            }
        }
        return DEFAULT;
    }
}
