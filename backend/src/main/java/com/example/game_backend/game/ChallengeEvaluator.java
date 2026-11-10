package com.example.game_backend.game;

import org.mozilla.javascript.Context;
import org.mozilla.javascript.ContextFactory;
import org.mozilla.javascript.Function;
import org.mozilla.javascript.NativeArray;
import org.mozilla.javascript.NativeObject;
import org.mozilla.javascript.RhinoException;
import org.mozilla.javascript.Scriptable;
import org.mozilla.javascript.ScriptableObject;
import org.mozilla.javascript.Undefined;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Runs player code on the SERVER (US-17, NFR-05) in a Rhino sandbox: no Java access,
 * hard CPU time limit, stack-depth limit, only plain values accepted as results.
 */
@Component
public class ChallengeEvaluator {
    private static final Object DEADLINE = new Object();
    private static final int VISIBLE_TESTS = 2;

    private final long timeoutMs;
    private final ExecutorService pool;
    private final SandboxFactory factory = new SandboxFactory();

    public ChallengeEvaluator(@Value("${game.eval-timeout-ms:3000}") long timeoutMs) {
        this.timeoutMs = timeoutMs;
        this.pool = Executors.newFixedThreadPool(4, r -> {
            Thread t = new Thread(r, "challenge-evaluator");
            t.setDaemon(true);
            return t;
        });
    }

    public EvalResult evaluate(String source, String functionName, String testsJson) {
        Future<EvalResult> future = pool.submit(() -> run(source, functionName, testsJson));
        try {
            return future.get(timeoutMs + 4000L, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            return EvalResult.error("Time limit exceeded");
        } catch (Exception e) {
            return EvalResult.error("Evaluator unavailable, please try again");
        }
    }

    private static final class ScriptTimeout extends Error {
        ScriptTimeout() {
            super("Time limit exceeded", null, false, false);
        }
    }

    private static final class SandboxFactory extends ContextFactory {
        @Override
        protected Context makeContext() {
            Context cx = super.makeContext();
            cx.setLanguageVersion(Context.VERSION_ES6);
            cx.setOptimizationLevel(-1);
            cx.setInstructionObserverThreshold(5000);
            cx.setMaximumInterpreterStackDepth(400);
            cx.setClassShutter(className -> false);
            return cx;
        }

        @Override
        protected void observeInstructionCount(Context cx, int instructionCount) {
            Object d = cx.getThreadLocal(DEADLINE);
            if (Thread.currentThread().isInterrupted() || (d instanceof Long && System.nanoTime() > (Long) d)) {
                throw new ScriptTimeout();
            }
        }
    }

    private EvalResult run(String source, String functionName, String testsJson) {
        Context cx = factory.enterContext();
        try {
            cx.putThreadLocal(DEADLINE, System.nanoTime() + timeoutMs * 1_000_000L);

            ScriptableObject trusted = cx.initSafeStandardObjects();
            List<?> tests;
            try {
                ScriptableObject.putProperty(trusted, "__src", testsJson);
                Object parsed = cx.evaluateString(trusted, "JSON.parse(__src)", "tests", 1, null);
                if (!(parsed instanceof List) || ((List<?>) parsed).isEmpty()) {
                    return EvalResult.error("This challenge has no tests");
                }
                tests = (List<?>) parsed;
            } catch (RhinoException e) {
                return EvalResult.error("This challenge has invalid tests");
            }

            ScriptableObject user = cx.initSafeStandardObjects();
            try {
                cx.evaluateString(user, source, "solution.js", 1, null);
            } catch (RhinoException e) {
                return EvalResult.error(shorten(e.getMessage()));
            }
            Object fnObj = user.get(functionName, user);
            if (!(fnObj instanceof Function)) {
                return EvalResult.error("Function '" + functionName + "' was not defined");
            }
            Function fn = (Function) fnObj;

            List<Map<String, Object>> details = new ArrayList<>();
            int passedCount = 0;
            for (int i = 0; i < tests.size(); i++) {
                Object entry = tests.get(i);
                if (!(entry instanceof Scriptable)) {
                    return EvalResult.error("This challenge has invalid tests");
                }
                Scriptable t = (Scriptable) entry;
                Object input = ScriptableObject.getProperty(t, "input");
                Object expectedRaw = ScriptableObject.getProperty(t, "expected");
                if (!(input instanceof List)) {
                    return EvalResult.error("This challenge has invalid tests");
                }
                List<?> inputList = (List<?>) input;
                Object[] args = new Object[inputList.size()];
                for (int a = 0; a < args.length; a++) {
                    args[a] = toScope(cx, user, inputList.get(a));
                }

                String expected = canon(expectedRaw);
                String actual;
                String error = null;
                try {
                    actual = canon(fn.call(cx, user, user, args));
                } catch (RhinoException e) {
                    actual = "error";
                    error = shorten(e.getMessage());
                } catch (IllegalArgumentException e) {
                    actual = "unsupported";
                    error = "Return a number, string, boolean or array";
                } catch (StackOverflowError e) {
                    actual = "error";
                    error = "Too much recursion";
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
                    d.put("input", canonArgs(inputList));
                    d.put("expected", expected);
                    d.put("actual", error != null ? error : shorten(actual));
                }
                details.add(d);
            }
            return new EvalResult(passedCount == tests.size(), passedCount, tests.size(), null, details);
        } catch (ScriptTimeout e) {
            return EvalResult.error("Time limit exceeded");
        } catch (StackOverflowError e) {
            return EvalResult.error("Too much recursion");
        } catch (RuntimeException e) {
            return EvalResult.error("Evaluator error");
        } finally {
            Context.exit();
        }
    }

    private static Object toScope(Context cx, Scriptable scope, Object v) {
        if (v instanceof NativeArray) {
            List<?> l = (List<?>) v;
            Object[] arr = new Object[l.size()];
            for (int i = 0; i < arr.length; i++) {
                arr[i] = toScope(cx, scope, l.get(i));
            }
            return cx.newArray(scope, arr);
        }
        if (v instanceof NativeObject) {
            NativeObject src = (NativeObject) v;
            Scriptable copy = cx.newObject(scope);
            for (Object id : src.getIds()) {
                String key = String.valueOf(id);
                ScriptableObject.putProperty(copy, key, toScope(cx, scope, ScriptableObject.getProperty(src, key)));
            }
            return copy;
        }
        if (v instanceof CharSequence) {
            return v.toString();
        }
        return v;
    }

    static String canon(Object v) {
        if (v == null) {
            return "null";
        }
        if (v instanceof Undefined || v == Scriptable.NOT_FOUND) {
            return "undefined";
        }
        if (v instanceof Boolean) {
            return v.toString();
        }
        if (v instanceof CharSequence) {
            return quote(v.toString());
        }
        if (v instanceof Number) {
            double d = ((Number) v).doubleValue();
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
        if (v instanceof NativeArray) {
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
            try {
                sb.append(canon(args.get(i)));
            } catch (IllegalArgumentException e) {
                sb.append("?");
            }
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
