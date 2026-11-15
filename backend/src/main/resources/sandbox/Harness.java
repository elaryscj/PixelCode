// Runs inside a separate, short-lived JVM started by ChallengeEvaluator. It is compiled once by the
// backend and placed on the child classpath next to the player's compiled Solution class.
//
// stdin : line 1 = method name, rest = tests JSON ([{"input":[...],"expected":...}, ...])
// stdout: one line per test, "R\t<json result>" or "E\t<error message>", then "DONE".
//         "F\t<message>" instead means the whole run failed (e.g. method not found).
//
// The player's code cannot reach this stdout: System.out / System.err are swapped for a capped sink
// before any player code runs, and on JDKs that still have it a SecurityManager denying everything
// is installed before the first call.

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintStream;
import java.lang.reflect.Array;
import java.lang.reflect.Constructor;
import java.lang.reflect.GenericArrayType;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class Harness {

    public static void main(String[] args) throws Exception {
        PrintStream out = new PrintStream(new java.io.FileOutputStream(java.io.FileDescriptor.out), true, StandardCharsets.UTF_8);
        String stdin = new String(readAll(System.in), StandardCharsets.UTF_8);
        int nl = stdin.indexOf('\n');
        String fnName = (nl < 0 ? stdin : stdin.substring(0, nl)).trim();
        String testsJson = nl < 0 ? "[]" : stdin.substring(nl + 1);

        // player output goes nowhere (and is capped, so printing in a loop cannot exhaust memory)
        PrintStream sink = new PrintStream(new CappedSink(), true, StandardCharsets.UTF_8);
        System.setOut(sink);
        System.setErr(sink);

        List<?> tests;
        try {
            Object parsed = new Json(testsJson).parse();
            if (!(parsed instanceof List)) throw new IllegalArgumentException();
            tests = (List<?>) parsed;
        } catch (RuntimeException e) {
            out.println("F\tThis challenge has invalid tests");
            return;
        }

        Class<?> cls;
        try {
            cls = Class.forName("Solution", false, Harness.class.getClassLoader());
        } catch (ClassNotFoundException e) {
            out.println("F\tDeclare your code inside: class Solution { ... }");
            return;
        }

        int arity = -1;
        if (!tests.isEmpty() && tests.get(0) instanceof Map && ((Map<?, ?>) tests.get(0)).get("input") instanceof List) {
            arity = ((List<?>) ((Map<?, ?>) tests.get(0)).get("input")).size();
        }
        Method method = null;
        for (Method m : cls.getDeclaredMethods()) {
            if (m.getName().equals(fnName) && (arity < 0 || m.getParameterCount() == arity)) {
                method = m;
                break;
            }
        }
        if (method == null) {
            out.println("F\tMethod '" + fnName + "' with " + arity + " parameter(s) was not found in class Solution");
            return;
        }
        if (Modifier.isPrivate(method.getModifiers())) {
            out.println("F\tMethod '" + fnName + "' must not be private");
            return;
        }

        // convert every test input up front, while we still may use reflection freely
        Type[] types = method.getGenericParameterTypes();
        List<Object[]> argLists = new ArrayList<>();
        for (Object t : tests) {
            if (!(t instanceof Map) || !(((Map<?, ?>) t).get("input") instanceof List)) {
                out.println("F\tThis challenge has invalid tests");
                return;
            }
            List<?> input = (List<?>) ((Map<?, ?>) t).get("input");
            if (input.size() != types.length) {
                out.println("F\tThis challenge has invalid tests");
                return;
            }
            Object[] a = new Object[types.length];
            try {
                for (int i = 0; i < a.length; i++) a[i] = convert(input.get(i), types[i]);
            } catch (RuntimeException e) {
                out.println("F\tThe parameter types of '" + fnName + "' do not fit the test data (" + e.getMessage() + ")");
                return;
            }
            argLists.add(a);
        }

        Constructor<?> ctor = null;
        if (!Modifier.isStatic(method.getModifiers())) {
            try {
                ctor = cls.getDeclaredConstructor();
            } catch (NoSuchMethodException e) {
                out.println("F\tMake '" + fnName + "' static, or give Solution a constructor without parameters");
                return;
            }
        }

        lockDown();

        for (Object[] a : argLists) {
            try {
                Object target = ctor == null ? null : ctor.newInstance();
                Object result = method.invoke(target, a);
                out.println("R\t" + toJson(result, method.getReturnType() == void.class));
            } catch (InvocationTargetException e) {
                out.println("E\t" + describe(e.getCause()));
            } catch (StackOverflowError e) {
                out.println("E\tToo much recursion (StackOverflowError)");
            } catch (OutOfMemoryError e) {
                out.println("E\tMemory limit exceeded (OutOfMemoryError)");
            } catch (UnsupportedResult e) {
                out.println("E\t" + e.getMessage());
            } catch (Throwable e) {
                out.println("E\t" + describe(e));
            }
        }
        out.println("DONE");
        out.flush();
        try {
            Runtime.getRuntime().halt(0); // do not wait for anything the player may have left behind
        } catch (SecurityException ignored) {
            // locked down: main simply returns and the JVM ends (the parent kills it on timeout anyway)
        }
    }

    /** JDK 17-23: forbid everything (files, network, processes, reflection, exit) from here on. */
    @SuppressWarnings({"removal", "deprecation"})
    private static void lockDown() {
        if (Runtime.version().feature() >= 24) return; // SecurityManager no longer exists there
        try {
            System.setSecurityManager(new SecurityManager());
        } catch (UnsupportedOperationException | SecurityException ignored) {
            // started without -Djava.security.manager=allow: the source allowlist still applies
        }
    }

    private static String describe(Throwable t) {
        if (t instanceof StackOverflowError) return "Too much recursion (StackOverflowError)";
        if (t instanceof OutOfMemoryError) return "Memory limit exceeded (OutOfMemoryError)";
        String msg = t.getMessage();
        String s = t.getClass().getSimpleName() + (msg == null ? "" : ": " + msg);
        s = s.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ');
        return s.length() > 200 ? s.substring(0, 200) + "..." : s;
    }

    // ---------------------------------------------------------------- JSON -> Java parameter values

    private static Object convert(Object v, Type type) {
        if (type instanceof Class) return convertTo(v, (Class<?>) type, null);
        if (type instanceof ParameterizedType) {
            ParameterizedType p = (ParameterizedType) type;
            return convertTo(v, (Class<?>) p.getRawType(), p.getActualTypeArguments());
        }
        if (type instanceof GenericArrayType) {
            Type comp = ((GenericArrayType) type).getGenericComponentType();
            List<?> l = asList(v);
            Class<?> raw = comp instanceof ParameterizedType ? (Class<?>) ((ParameterizedType) comp).getRawType() : Object.class;
            Object arr = Array.newInstance(raw, l.size());
            for (int i = 0; i < l.size(); i++) Array.set(arr, i, convert(l.get(i), comp));
            return arr;
        }
        return natural(v);
    }

    private static Object convertTo(Object v, Class<?> c, Type[] typeArgs) {
        if (v == null) {
            if (c.isPrimitive()) throw new IllegalArgumentException("null for " + c.getSimpleName());
            return null;
        }
        if (c == int.class || c == Integer.class) return (int) integral(v, Integer.MIN_VALUE, Integer.MAX_VALUE);
        if (c == long.class || c == Long.class) return integral(v, Long.MIN_VALUE, Long.MAX_VALUE);
        if (c == short.class || c == Short.class) return (short) integral(v, Short.MIN_VALUE, Short.MAX_VALUE);
        if (c == byte.class || c == Byte.class) return (byte) integral(v, Byte.MIN_VALUE, Byte.MAX_VALUE);
        if (c == double.class || c == Double.class) return number(v).doubleValue();
        if (c == float.class || c == Float.class) return number(v).floatValue();
        if (c == boolean.class || c == Boolean.class) {
            if (v instanceof Boolean) return v;
            throw new IllegalArgumentException("expected true/false, got " + v);
        }
        if (c == char.class || c == Character.class) {
            if (v instanceof String && ((String) v).length() == 1) return ((String) v).charAt(0);
            throw new IllegalArgumentException("expected a one-letter string for char");
        }
        if (c == String.class || c == CharSequence.class) {
            if (v instanceof String) return v;
            throw new IllegalArgumentException("expected a string, got " + v);
        }
        if (c.isArray()) {
            if (c == char[].class && v instanceof String) return ((String) v).toCharArray();
            List<?> l = asList(v);
            Object arr = Array.newInstance(c.getComponentType(), l.size());
            for (int i = 0; i < l.size(); i++) Array.set(arr, i, convertTo(l.get(i), c.getComponentType(), null));
            return arr;
        }
        Type elem = typeArgs != null && typeArgs.length > 0 ? typeArgs[0] : Object.class;
        if (c == List.class || c == Collection.class || c == Iterable.class || c == ArrayList.class) {
            List<Object> out = new ArrayList<>();
            for (Object o : asList(v)) out.add(convert(o, elem));
            return out;
        }
        if (c == Set.class || c == LinkedHashSet.class) {
            Set<Object> out = new LinkedHashSet<>();
            for (Object o : asList(v)) out.add(convert(o, elem));
            return out;
        }
        if (c == Map.class || c == LinkedHashMap.class) {
            if (!(v instanceof Map)) throw new IllegalArgumentException("expected an object for Map");
            Type kt = typeArgs != null && typeArgs.length > 1 ? typeArgs[0] : String.class;
            Type vt = typeArgs != null && typeArgs.length > 1 ? typeArgs[1] : Object.class;
            Map<Object, Object> out = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : ((Map<?, ?>) v).entrySet()) {
                Object key = kt == String.class || kt == Object.class ? e.getKey() : convert(new Json(String.valueOf(e.getKey())).parse(), kt);
                out.put(key, convert(e.getValue(), vt));
            }
            return out;
        }
        if (c == Object.class || c == Number.class) return natural(v);
        throw new IllegalArgumentException("unsupported parameter type " + c.getSimpleName());
    }

    private static Object natural(Object v) {
        if (v instanceof Long && (Long) v >= Integer.MIN_VALUE && (Long) v <= Integer.MAX_VALUE) return ((Long) v).intValue();
        if (v instanceof List) {
            List<Object> out = new ArrayList<>();
            for (Object o : (List<?>) v) out.add(natural(o));
            return out;
        }
        return v;
    }

    private static List<?> asList(Object v) {
        if (v instanceof List) return (List<?>) v;
        throw new IllegalArgumentException("expected an array, got " + v);
    }

    private static Number number(Object v) {
        if (v instanceof Number) return (Number) v;
        throw new IllegalArgumentException("expected a number, got " + v);
    }

    private static long integral(Object v, long min, long max) {
        Number n = number(v);
        if (n instanceof Double) {
            double d = n.doubleValue();
            if (d != Math.rint(d)) throw new IllegalArgumentException("expected a whole number, got " + d);
            n = (long) d;
        }
        long l = n.longValue();
        if (l < min || l > max) throw new IllegalArgumentException(l + " is out of range");
        return l;
    }

    // ---------------------------------------------------------------- Java result -> JSON

    private static final class UnsupportedResult extends RuntimeException {
        UnsupportedResult(String m) { super(m, null, false, false); }
    }

    private static String toJson(Object v, boolean isVoid) {
        if (isVoid) throw new UnsupportedResult("Your method returns nothing (void): return the answer instead");
        StringBuilder sb = new StringBuilder();
        write(sb, v, 0);
        return sb.toString();
    }

    private static void write(StringBuilder sb, Object v, int depth) {
        if (depth > 32 || sb.length() > 100_000) throw new UnsupportedResult("The result is too large");
        if (v == null) { sb.append("null"); return; }
        if (v instanceof Boolean) { sb.append(v); return; }
        if (v instanceof Integer || v instanceof Long || v instanceof Short || v instanceof Byte) { sb.append(((Number) v).longValue()); return; }
        if (v instanceof Double || v instanceof Float) {
            double d = ((Number) v).doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d)) { sb.append('"').append(d).append('"'); return; }
            sb.append(Double.toString(d));
            return;
        }
        if (v instanceof Character) { quote(sb, v.toString()); return; }
        if (v instanceof CharSequence) { quote(sb, v.toString()); return; }
        if (v.getClass().isArray()) {
            sb.append('[');
            int n = Array.getLength(v);
            for (int i = 0; i < n; i++) {
                if (i > 0) sb.append(',');
                write(sb, Array.get(v, i), depth + 1);
            }
            sb.append(']');
            return;
        }
        if (v instanceof Iterable) {
            sb.append('[');
            boolean first = true;
            for (Object o : (Iterable<?>) v) {
                if (!first) sb.append(',');
                first = false;
                write(sb, o, depth + 1);
            }
            sb.append(']');
            return;
        }
        throw new UnsupportedResult("Return a number, string, boolean, array or list (got " + v.getClass().getSimpleName() + ")");
    }

    private static void quote(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        sb.append('"');
    }

    // ---------------------------------------------------------------- tiny JSON parser (no libraries here)

    private static final class Json {
        private final String s;
        private int i;

        Json(String s) { this.s = s; }

        Object parse() {
            Object v = value();
            ws();
            if (i != s.length()) throw new IllegalArgumentException("trailing data");
            return v;
        }

        private void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }

        private Object value() {
            ws();
            if (i >= s.length()) throw new IllegalArgumentException("unexpected end");
            char c = s.charAt(i);
            if (c == '{') return object();
            if (c == '[') return array();
            if (c == '"') return string();
            if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
            if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
            if (s.startsWith("null", i)) { i += 4; return null; }
            return number();
        }

        private Map<String, Object> object() {
            Map<String, Object> m = new LinkedHashMap<>();
            i++;
            ws();
            if (i < s.length() && s.charAt(i) == '}') { i++; return m; }
            while (true) {
                ws();
                String k = string();
                ws();
                expect(':');
                m.put(k, value());
                ws();
                if (i < s.length() && s.charAt(i) == ',') { i++; continue; }
                expect('}');
                return m;
            }
        }

        private List<Object> array() {
            List<Object> l = new ArrayList<>();
            i++;
            ws();
            if (i < s.length() && s.charAt(i) == ']') { i++; return l; }
            while (true) {
                l.add(value());
                ws();
                if (i < s.length() && s.charAt(i) == ',') { i++; continue; }
                expect(']');
                return l;
            }
        }

        private String string() {
            expect('"');
            StringBuilder sb = new StringBuilder();
            while (i < s.length()) {
                char c = s.charAt(i++);
                if (c == '"') return sb.toString();
                if (c != '\\') { sb.append(c); continue; }
                if (i >= s.length()) break;
                char e = s.charAt(i++);
                switch (e) {
                    case 'n': sb.append('\n'); break;
                    case 't': sb.append('\t'); break;
                    case 'r': sb.append('\r'); break;
                    case 'b': sb.append('\b'); break;
                    case 'f': sb.append('\f'); break;
                    case 'u':
                        sb.append((char) Integer.parseInt(s.substring(i, i + 4), 16));
                        i += 4;
                        break;
                    default: sb.append(e);
                }
            }
            throw new IllegalArgumentException("unterminated string");
        }

        private Object number() {
            int start = i;
            while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
            String n = s.substring(start, i);
            if (n.isEmpty()) throw new IllegalArgumentException("bad value at " + start);
            if (n.contains(".") || n.contains("e") || n.contains("E")) return Double.parseDouble(n);
            return Long.parseLong(n);
        }

        private void expect(char c) {
            if (i >= s.length() || s.charAt(i) != c) throw new IllegalArgumentException("expected " + c);
            i++;
        }
    }

    // ---------------------------------------------------------------- misc

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) {
            b.write(buf, 0, n);
            if (b.size() > 2_000_000) throw new IOException("input too large");
        }
        return b.toByteArray();
    }

    /** Swallows player output, at most ~64 KB is even looked at. */
    private static final class CappedSink extends OutputStream {
        private long written;
        @Override public void write(int b) { written++; }
        @Override public void write(byte[] b, int off, int len) { written += len; }
    }
}
