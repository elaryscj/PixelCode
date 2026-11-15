package com.example.game_backend.game;

import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.util.JavacTask;
import com.sun.source.util.Trees;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.SimpleJavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.StandardLocation;
import javax.tools.ToolProvider;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.Stream;

/**
 * Checks player solutions written in Java on the SERVER (US-17, NFR-05).
 *
 * <ol>
 *   <li>javac compiles the code in memory; a {@link SourcePolicy} allowlist refuses anything that is not plain
 *       computation (no files, network, processes, threads, reflection, System.exit/getenv).</li>
 *   <li>The compiled class runs in a separate short-lived JVM: small heap, empty environment (no secrets),
 *       stdout only via the harness, wall-clock limit, and on JDK 21 a SecurityManager that denies everything.</li>
 * </ol>
 */
@Component
public class ChallengeEvaluator {
    private static final Logger log = LoggerFactory.getLogger(ChallengeEvaluator.class);
    private static final int VISIBLE_TESTS = 2;
    private static final int MAX_SOURCE_CHARS = 20_000;
    private static final int MAX_OUTPUT_BYTES = 512 * 1024;
    private static final String RELEASE = "21";

    private final long timeoutMs;
    private final long startupMs;
    private final Semaphore slots;
    private final ExecutorService compilePool;
    private final JsonMapper json = JsonMapper.builder().build();
    private volatile Path harnessDir;

    public ChallengeEvaluator(@Value("${game.eval-timeout-ms:3000}") long timeoutMs,
                              @Value("${game.eval-startup-ms:4000}") long startupMs,
                              @Value("${game.eval-concurrency:2}") int concurrency) {
        this.timeoutMs = timeoutMs;
        this.startupMs = startupMs;
        this.slots = new Semaphore(Math.max(1, concurrency), true);
        this.compilePool = Executors.newFixedThreadPool(Math.max(1, concurrency), r -> {
            Thread t = new Thread(r, "challenge-compiler");
            t.setDaemon(true);
            return t;
        });
    }

    public EvalResult evaluate(String source, String functionName, String testsJson) {
        if (source == null || source.isBlank()) {
            return EvalResult.error("Write your solution first");
        }
        if (source.length() > MAX_SOURCE_CHARS) {
            return EvalResult.error("The code is too long (max " + MAX_SOURCE_CHARS + " characters)");
        }
        List<Object> tests;
        try {
            Object parsed = json.readValue(testsJson, Object.class);
            if (!(parsed instanceof List) || ((List<?>) parsed).isEmpty()) {
                return EvalResult.error("This challenge has no tests");
            }
            @SuppressWarnings("unchecked")
            List<Object> list = (List<Object>) parsed;
            tests = list;
            for (Object t : tests) {
                if (!(t instanceof Map) || !(((Map<?, ?>) t).get("input") instanceof List)) {
                    return EvalResult.error("This challenge has invalid tests");
                }
            }
        } catch (RuntimeException e) {
            return EvalResult.error("This challenge has invalid tests");
        }

        boolean acquired = false;
        Path work = null;
        try {
            acquired = slots.tryAcquire(15, TimeUnit.SECONDS);
            if (!acquired) {
                return EvalResult.error("The checker is busy, please try again");
            }
            work = Files.createTempDirectory("pc-sub-");
            Path harness = harness();
            String compileError = compile(source, work);
            if (compileError != null) {
                return EvalResult.error(compileError);
            }
            return run(harness, work, functionName, testsJson, tests);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return EvalResult.error("Evaluator unavailable, please try again");
        } catch (Exception e) {
            log.error("Evaluator failure", e);
            return EvalResult.error("Evaluator unavailable, please try again");
        } finally {
            if (acquired) {
                slots.release();
            }
            deleteQuietly(work);
        }
    }

    // ------------------------------------------------------------------ compile + policy

    private String compile(String source, Path outDir) throws Exception {
        Future<String> f = compilePool.submit(() -> compileNow(source, outDir));
        try {
            return f.get(10, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            f.cancel(true);
            return "Compilation took too long";
        }
    }

    private String compileNow(String source, Path outDir) throws IOException {
        JavaCompiler javac = ToolProvider.getSystemJavaCompiler();
        if (javac == null) {
            throw new IllegalStateException("No Java compiler: the backend must run on a JDK, not a JRE");
        }
        DiagnosticCollector<JavaFileObject> diags = new DiagnosticCollector<>();
        try (StandardJavaFileManager fm = javac.getStandardFileManager(diags, Locale.ENGLISH, StandardCharsets.UTF_8)) {
            fm.setLocation(StandardLocation.CLASS_OUTPUT, List.of(outDir.toFile()));
            fm.setLocation(StandardLocation.CLASS_PATH, List.of());
            List<String> options = List.of("--release", RELEASE, "-proc:none", "-implicit:none", "-g:none",
                    "-nowarn", "-Xlint:none", "-encoding", "UTF-8");
            JavacTask task = (JavacTask) javac.getTask(null, fm, diags, options, null, List.of(new Source(source)));
            Iterable<? extends CompilationUnitTree> units = task.parse();
            task.analyze();
            String err = firstErrors(diags);
            if (err != null) {
                return err;
            }
            String why = SourcePolicy.check(units, Trees.instance(task));
            if (why != null) {
                return why;
            }
            task.generate();
            return firstErrors(diags);
        }
    }

    private static String firstErrors(DiagnosticCollector<JavaFileObject> diags) {
        List<String> lines = new ArrayList<>();
        for (Diagnostic<? extends JavaFileObject> d : diags.getDiagnostics()) {
            if (d.getKind() != Diagnostic.Kind.ERROR) {
                continue;
            }
            String msg = d.getMessage(Locale.ENGLISH);
            int nl = msg.indexOf('\n');
            lines.add("Line " + d.getLineNumber() + ": " + (nl > 0 ? msg.substring(0, nl) : msg));
            if (lines.size() == 3) {
                break;
            }
        }
        return lines.isEmpty() ? null : String.join("\n", lines);
    }

    private static final class Source extends SimpleJavaFileObject {
        private final String code;

        Source(String code) {
            super(URI.create("string:///Solution.java"), Kind.SOURCE);
            this.code = code;
        }

        @Override
        public CharSequence getCharContent(boolean ignoreEncodingErrors) {
            return code;
        }
    }

    /** Compiles the bundled harness once per backend process. */
    private Path harness() throws IOException {
        Path dir = harnessDir;
        if (dir != null) {
            return dir;
        }
        synchronized (this) {
            if (harnessDir != null) {
                return harnessDir;
            }
            String src;
            try (InputStream in = ChallengeEvaluator.class.getResourceAsStream("/sandbox/Harness.java")) {
                if (in == null) {
                    throw new IllegalStateException("sandbox/Harness.java is missing from the backend");
                }
                src = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            }
            Path out = Files.createTempDirectory("pc-harness-");
            JavaCompiler javac = ToolProvider.getSystemJavaCompiler();
            if (javac == null) {
                throw new IllegalStateException("No Java compiler: the backend must run on a JDK, not a JRE");
            }
            DiagnosticCollector<JavaFileObject> diags = new DiagnosticCollector<>();
            try (StandardJavaFileManager fm = javac.getStandardFileManager(diags, Locale.ENGLISH, StandardCharsets.UTF_8)) {
                fm.setLocation(StandardLocation.CLASS_OUTPUT, List.of(out.toFile()));
                fm.setLocation(StandardLocation.CLASS_PATH, List.of());
                SimpleJavaFileObject file = new SimpleJavaFileObject(URI.create("string:///Harness.java"), JavaFileObject.Kind.SOURCE) {
                    @Override
                    public CharSequence getCharContent(boolean ignore) {
                        return src;
                    }
                };
                Boolean ok = javac.getTask(null, fm, diags, List.of("--release", RELEASE, "-nowarn", "-Xlint:none"), null, List.of(file)).call();
                if (!Boolean.TRUE.equals(ok)) {
                    throw new IllegalStateException("Harness does not compile: " + diags.getDiagnostics());
                }
            }
            harnessDir = out;
            return out;
        }
    }

    // ------------------------------------------------------------------ run in a separate JVM

    private EvalResult run(Path harness, Path work, String functionName, String testsJson, List<Object> tests)
            throws IOException, InterruptedException {
        String javaBin = Path.of(System.getProperty("java.home"), "bin", "java").toString();
        List<String> cmd = new ArrayList<>(List.of(javaBin,
                "-Xmx64m", "-Xss2m", "-XX:MaxMetaspaceSize=48m", "-XX:ReservedCodeCacheSize=16m",
                "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", "-XX:ActiveProcessorCount=1",
                "-XX:-UsePerfData", "-Xshare:auto", "-Dfile.encoding=UTF-8"));
        if (Runtime.version().feature() < 24) {
            cmd.add("-Djava.security.manager=allow"); // the harness installs a deny-all SecurityManager
        }
        cmd.addAll(List.of("-cp", harness + File.pathSeparator + work, "Harness"));

        Path outFile = work.resolve("out.txt");
        ProcessBuilder pb = new ProcessBuilder(cmd)
                .directory(work.toFile())
                .redirectOutput(outFile.toFile())
                .redirectError(ProcessBuilder.Redirect.DISCARD);
        pb.environment().clear(); // DB password, token secret etc. never reach player code
        Process p = pb.start();
        try (OutputStream stdin = p.getOutputStream()) {
            stdin.write((functionName + "\n" + testsJson).getBytes(StandardCharsets.UTF_8));
        } catch (IOException ignored) {
            // the process may already be gone; handled below
        }
        boolean finished = p.waitFor(timeoutMs + startupMs, TimeUnit.MILLISECONDS);
        if (!finished) {
            p.destroyForcibly();
            p.waitFor(2, TimeUnit.SECONDS);
            return EvalResult.error("Time limit exceeded (" + (timeoutMs / 1000.0) + " s): is there an endless loop?");
        }

        List<String> lines = readLines(outFile);
        for (String line : lines) {
            if (line.startsWith("F\t")) {
                return EvalResult.error(line.substring(2));
            }
        }
        List<String> results = new ArrayList<>();
        boolean done = false;
        for (String line : lines) {
            if (line.equals("DONE")) {
                done = true;
            } else if (line.startsWith("R\t") || line.startsWith("E\t")) {
                results.add(line);
            }
        }
        if (!done || results.size() != tests.size()) {
            return EvalResult.error("Your code crashed the checker (too much memory?)");
        }

        List<Map<String, Object>> details = new ArrayList<>();
        int passedCount = 0;
        for (int i = 0; i < tests.size(); i++) {
            Map<?, ?> t = (Map<?, ?>) tests.get(i);
            List<?> input = (List<?>) t.get("input");
            String expected = safeCanon(t.get("expected"));
            String line = results.get(i);
            String actual;
            String error = null;
            if (line.startsWith("E\t")) {
                actual = "error";
                error = line.substring(2);
            } else {
                try {
                    actual = canon(json.readValue(line.substring(2), Object.class));
                } catch (RuntimeException e) {
                    actual = "unsupported";
                    error = "Return a number, string, boolean, array or list";
                }
            }
            boolean ok = error == null && expected.equals(actual);
            if (ok) {
                passedCount++;
            }
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("index", i + 1);
            d.put("passed", ok);
            boolean visible = i < VISIBLE_TESTS;
            d.put("visible", visible);
            if (visible) {
                d.put("input", canonArgs(input));
                d.put("expected", expected);
                d.put("actual", error != null ? shorten(error) : shorten(actual));
            }
            details.add(d);
        }
        return new EvalResult(passedCount == tests.size(), passedCount, tests.size(), null, details);
    }

    private static List<String> readLines(Path file) throws IOException {
        if (!Files.exists(file)) {
            return List.of();
        }
        byte[] all;
        try (InputStream in = Files.newInputStream(file)) {
            all = in.readNBytes(MAX_OUTPUT_BYTES);
        }
        return List.of(new String(all, StandardCharsets.UTF_8).split("\n"));
    }

    private static void deleteQuietly(Path dir) {
        if (dir == null) {
            return;
        }
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // temp files are cleaned up by the OS eventually
                }
            });
        } catch (IOException ignored) {
            // nothing else to do
        }
    }

    // ------------------------------------------------------------------ canonical text for comparing values

    private static String safeCanon(Object v) {
        try {
            return canon(v);
        } catch (IllegalArgumentException e) {
            return "?";
        }
    }

    static String canon(Object v) {
        if (v == null) {
            return "null";
        }
        if (v instanceof Boolean) {
            return v.toString();
        }
        if (v instanceof CharSequence) {
            return quote(v.toString());
        }
        if (v instanceof Number) {
            double d = ((Number) v).doubleValue();
            if (v instanceof Long || v instanceof Integer || v instanceof Short || v instanceof Byte
                    || v instanceof java.math.BigInteger) {
                return v.toString();
            }
            if (Double.isNaN(d)) {
                return "NaN";
            }
            if (Double.isInfinite(d)) {
                return d > 0 ? "Infinity" : "-Infinity";
            }
            if (d == Math.rint(d) && Math.abs(d) < 1e15) {
                return Long.toString((long) d);
            }
            return Double.toString(d);
        }
        if (v instanceof List) {
            List<?> l = (List<?>) v;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < l.size(); i++) {
                if (i > 0) {
                    sb.append(',');
                }
                sb.append(canon(l.get(i)));
            }
            return sb.append(']').toString();
        }
        throw new IllegalArgumentException("unsupported value");
    }

    private static String canonArgs(List<?> args) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < args.size(); i++) {
            if (i > 0) {
                sb.append(", ");
            }
            sb.append(safeCanon(args.get(i)));
        }
        return sb.toString();
    }

    private static String quote(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default: sb.append(c);
            }
        }
        return sb.append('"').toString();
    }

    private static String shorten(String s) {
        if (s == null) {
            return "error";
        }
        return s.length() > 200 ? s.substring(0, 200) + "..." : s;
    }
}
