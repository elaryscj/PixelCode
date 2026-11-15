package com.example.game_backend.game;

import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Builds the Java starter code a player sees ("class Solution { public static int solve(int a, int b) ... }").
 * Parameter and return types are inferred from the tests JSON, so tests stay language-neutral and old
 * JavaScript challenges can be converted automatically.
 */
public final class JavaStarter {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Pattern JS_SIGNATURE = Pattern.compile("function\\s+[A-Za-z_$][\\w$]*\\s*\\(([^)]*)\\)");
    private static final Pattern IDENT = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");

    private JavaStarter() {
    }

    /** True when the starter code is still the old JavaScript form. */
    public static boolean isJavaScript(String starterCode) {
        return starterCode == null || starterCode.isBlank()
                || (starterCode.contains("function") && !starterCode.contains("class "));
    }

    /**
     * @param functionName method name, e.g. "solve"
     * @param testsJson    [{"input":[...],"expected":...}, ...]
     * @param oldJsStarter optional old JavaScript starter, only used to keep the parameter names
     */
    public static String build(String functionName, String testsJson, String oldJsStarter) {
        List<List<Object>> inputs = new ArrayList<>();
        List<Object> expected = new ArrayList<>();
        try {
            Object parsed = JSON.readValue(testsJson, Object.class);
            if (parsed instanceof List) {
                for (Object t : (List<?>) parsed) {
                    if (t instanceof Map && ((Map<?, ?>) t).get("input") instanceof List) {
                        @SuppressWarnings("unchecked")
                        List<Object> in = (List<Object>) ((Map<?, ?>) t).get("input");
                        inputs.add(in);
                        expected.add(((Map<?, ?>) t).get("expected"));
                    }
                }
            }
        } catch (RuntimeException ignored) {
            // no usable tests: fall back to a parameterless method
        }

        int arity = inputs.isEmpty() ? 0 : inputs.get(0).size();
        List<String> names = jsParameterNames(oldJsStarter, arity);
        StringBuilder params = new StringBuilder();
        for (int i = 0; i < arity; i++) {
            List<Object> column = new ArrayList<>();
            for (List<Object> in : inputs) {
                if (in.size() > i) {
                    column.add(in.get(i));
                }
            }
            if (i > 0) {
                params.append(", ");
            }
            params.append(typeOf(column)).append(' ').append(names.get(i));
        }
        String ret = typeOf(expected);
        return "class Solution {\n"
                + "    public static " + ret + " " + functionName + "(" + params + ") {\n"
                + "        // TODO: write your solution\n"
                + "        return " + defaultValue(ret) + ";\n"
                + "    }\n"
                + "}\n";
    }

    private static List<String> jsParameterNames(String js, int arity) {
        List<String> names = new ArrayList<>();
        if (js != null) {
            Matcher m = JS_SIGNATURE.matcher(js);
            if (m.find()) {
                for (String raw : m.group(1).split(",")) {
                    String n = raw.trim();
                    if (IDENT.matcher(n).matches() && !names.contains(n)) {
                        names.add(n);
                    }
                }
            }
        }
        if (names.size() != arity) {
            names.clear();
            for (int i = 0; i < arity; i++) {
                names.add(arity <= 3 ? String.valueOf((char) ('a' + i)) : "arg" + i);
            }
        }
        return names;
    }

    /** The narrowest Java type that fits every sample value. */
    static String typeOf(List<?> samples) {
        String kind = null;
        List<Object> elements = new ArrayList<>();
        boolean anyList = false;
        for (Object v : samples) {
            String k;
            if (v == null) {
                continue;
            } else if (v instanceof Boolean) {
                k = "boolean";
            } else if (v instanceof Integer || v instanceof Short || v instanceof Byte) {
                k = "int";
            } else if (v instanceof Long || v instanceof java.math.BigInteger) {
                k = "long";
            } else if (v instanceof Number) {
                k = "double";
            } else if (v instanceof String) {
                k = "String";
            } else if (v instanceof List) {
                k = "list";
                anyList = true;
                elements.addAll((List<?>) v);
            } else {
                return "Object";
            }
            kind = merge(kind, k);
            if (kind.equals("Object")) {
                return "Object";
            }
        }
        if (kind == null) {
            return anyList ? "int[]" : "int";
        }
        if (kind.equals("list")) {
            String inner = elements.isEmpty() ? "int" : typeOf(elements);
            return inner.equals("Object") ? "Object[]" : inner + "[]";
        }
        return kind;
    }

    private static String merge(String a, String b) {
        if (a == null || a.equals(b)) {
            return b;
        }
        boolean numA = a.equals("int") || a.equals("long") || a.equals("double");
        boolean numB = b.equals("int") || b.equals("long") || b.equals("double");
        if (numA && numB) {
            return a.equals("double") || b.equals("double") ? "double" : "long";
        }
        return "Object";
    }

    private static String defaultValue(String type) {
        switch (type) {
            case "int": return "0";
            case "long": return "0L";
            case "double": return "0.0";
            case "boolean": return "false";
            case "String": return "\"\"";
            default:
                if (type.endsWith("[]")) {
                    return "new " + type.substring(0, type.indexOf('[')) + "[0]" + type.substring(type.indexOf('[') + 2);
                }
                return "null";
        }
    }
}
