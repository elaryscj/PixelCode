package com.example.game_backend.game;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChallengeEvaluatorTest {
    private final ChallengeEvaluator evaluator = new ChallengeEvaluator(3000, 4000, 2);

    private static final String SUM_TESTS =
            "[{\"input\":[3,7],\"expected\":10},{\"input\":[-5,12],\"expected\":7},{\"input\":[0,0],\"expected\":0}]";

    private EvalResult sum(String body) {
        return evaluator.evaluate("class Solution {\n" + body + "\n}", "solve", SUM_TESTS);
    }

    /** Code that must be refused before it ever runs. */
    private void refused(String code, String tests, String expectedFragment) {
        EvalResult r = evaluator.evaluate(code, "solve", tests);
        assertFalse(r.passed, code);
        assertNotNull(r.errorMessage, code);
        assertTrue(r.errorMessage.contains(expectedFragment), "message was: " + r.errorMessage);
    }

    // ---------------------------------------------------------------- normal solving

    @Test
    void correctSolutionPasses() {
        EvalResult r = sum("public static int solve(int a, int b) { return a + b; }");
        assertNull(r.errorMessage);
        assertTrue(r.passed);
        assertEquals(3, r.passedCount);
    }

    @Test
    void wrongSolutionFailsWithVisibleDetails() {
        EvalResult r = sum("public static int solve(int a, int b) { return a - b; }");
        assertNull(r.errorMessage);
        assertFalse(r.passed);
        assertEquals("3, 7", r.details.get(0).get("input"));
        assertEquals("10", r.details.get(0).get("expected"));
        assertEquals("-4", r.details.get(0).get("actual"));
    }

    @Test
    void instanceMethodsImportsAndCollectionsWork() {
        String code = "import java.util.*;\nimport java.util.stream.*;\n"
                + "class Solution {\n"
                + "  public int[] solve(int[] nums) {\n"
                + "    List<Integer> l = new ArrayList<>();\n"
                + "    for (int n : nums) l.add(n * n);\n"
                + "    System.out.println(\"debug \" + l);\n"
                + "    return l.stream().mapToInt(Integer::intValue).toArray();\n"
                + "  }\n}";
        EvalResult r = evaluator.evaluate(code, "solve",
                "[{\"input\":[[1,2,3]],\"expected\":[1,4,9]},{\"input\":[[]],\"expected\":[]}]");
        assertNull(r.errorMessage);
        assertTrue(r.passed);
    }

    @Test
    void stringsBooleansAndListsWork() {
        String code = "import java.util.List;\nclass Solution {\n"
                + "  static boolean solve(String s, List<String> words) { return words.contains(new StringBuilder(s).reverse().toString()); }\n}";
        EvalResult r = evaluator.evaluate(code, "solve",
                "[{\"input\":[\"abc\",[\"cba\",\"x\"]],\"expected\":true},{\"input\":[\"ab\",[]],\"expected\":false}]");
        assertNull(r.errorMessage);
        assertTrue(r.passed);
    }

    @Test
    void compileErrorsAreReportedWithLineNumbers() {
        EvalResult r = sum("public static int solve(int a, int b) { return a + b }");
        assertFalse(r.passed);
        assertTrue(r.errorMessage.startsWith("Line 2:"), r.errorMessage);
    }

    @Test
    void runtimeExceptionIsShownPerTest() {
        EvalResult r = sum("public static int solve(int a, int b) { return a / b; }");
        assertNull(r.errorMessage);
        assertFalse(r.passed);
        assertTrue(String.valueOf(r.details.get(2).get("passed")).equals("false"));
    }

    @Test
    void missingMethodIsExplained() {
        EvalResult r = sum("public static int add(int a, int b) { return a + b; }");
        assertTrue(r.errorMessage.contains("'solve'"), r.errorMessage);
    }

    // ---------------------------------------------------------------- resource limits

    @Test
    void endlessLoopHitsTheTimeLimit() {
        EvalResult r = sum("public static int solve(int a, int b) { while (true) { } }");
        assertTrue(r.errorMessage.startsWith("Time limit exceeded"), r.errorMessage);
    }

    @Test
    void deepRecursionIsReported() {
        EvalResult r = sum("public static int solve(int a, int b) { return solve(a + 1, b); }");
        assertNull(r.errorMessage);
        assertTrue(String.valueOf(r.details.get(0).get("actual")).contains("recursion"));
    }

    @Test
    void memoryBombDoesNotCrashTheBackend() {
        EvalResult r = sum("public static int solve(int a, int b) {"
                + " java.util.List<long[]> l = new java.util.ArrayList<>(); while (true) l.add(new long[1_000_000]); }");
        assertFalse(r.passed);
    }

    // ---------------------------------------------------------------- refused before running

    @Test
    void fileAccessIsRefused() {
        refused("import java.io.*;\nclass Solution { static int solve(int a, int b) throws Exception {"
                + " new FileReader(\"/etc/passwd\").read(); return 0; } }", SUM_TESTS, "not available");
        refused("class Solution { static int solve(int a, int b) throws Exception {"
                + " return java.nio.file.Files.readAllLines(java.nio.file.Path.of(\".env\")).size(); } }", SUM_TESTS, "not available");
    }

    @Test
    void processesAndExitAreRefused() {
        refused("class Solution { static int solve(int a, int b) throws Exception {"
                + " Runtime.getRuntime().exec(\"rm -rf /\"); return 0; } }", SUM_TESTS, "Runtime is not available");
        refused("class Solution { static int solve(int a, int b) { System.exit(1); return 0; } }", SUM_TESTS, "System.exit");
        refused("class Solution { static int solve(int a, int b) { new ProcessBuilder(\"ls\"); return 0; } }", SUM_TESTS, "not available");
    }

    @Test
    void secretsAndPropertiesAreRefused() {
        refused("class Solution { static String solve(int a, int b) { return System.getenv(\"DB_PASSWORD\"); } }",
                SUM_TESTS, "System.getenv");
        refused("class Solution { static String solve(int a, int b) { return System.getProperty(\"user.home\"); } }",
                SUM_TESTS, "System.getProperty");
        refused("class Solution { static Integer solve(int a, int b) { return Integer.getInteger(\"x\"); } }",
                SUM_TESTS, "getInteger");
        refused("import static java.lang.System.*;\nclass Solution { static String solve(int a, int b) { return getenv(\"X\"); } }",
                SUM_TESTS, "System.getenv");
    }

    @Test
    void reflectionAndClassLoadingAreRefused() {
        refused("class Solution { static int solve(int a, int b) throws Exception {"
                + " Class.forName(\"java.lang.Runtime\"); return 0; } }", SUM_TESTS, "Class is not available");
        refused("class Solution { static int solve(int a, int b) { Object o = \"x\".getClass(); return 0; } }",
                SUM_TESTS, "getClass");
        refused("class Solution { static int solve(int a, int b) { Object o = String.class; return 0; } }",
                SUM_TESTS, "class literals");
        refused("import java.lang.reflect.*;\nclass Solution { static int solve(int a, int b) { Method m = null; return 0; } }",
                SUM_TESTS, "not available");
        refused("class Solution { static int solve(int a, int b) { java.util.function.Function<Object, Object> f = Object::getClass; return 0; } }",
                SUM_TESTS, "getClass");
    }

    @Test
    void threadsAndNetworkAreRefused() {
        refused("class Solution { static int solve(int a, int b) { new Thread(() -> {}).start(); return 0; } }",
                SUM_TESTS, "Thread is not available");
        refused("class Solution { static int solve(int a, int b) throws Exception {"
                + " new java.net.Socket(\"example.com\", 80); return 0; } }", SUM_TESTS, "not available");
        refused("class Solution { static int solve(int a, int b) {"
                + " return java.util.stream.IntStream.range(0, 5).parallel().sum(); } }", SUM_TESTS, "parallel");
        refused("class Solution { static int solve(int a, int b) {"
                + " java.util.concurrent.Executors.newFixedThreadPool(2); return 0; } }", SUM_TESTS, "not available");
    }

    @Test
    void sneakyRoutesAreRefused() {
        // extending a dangerous class, a nested class named like a JDK one, package declaration
        refused("class Solution extends Thread { static int solve(int a, int b) { return 0; } }", SUM_TESTS, "Thread");
        refused("package evil;\nclass Solution { static int solve(int a, int b) { return 0; } }", SUM_TESTS, "package");
        refused("class Solution { static int solve(int a, int b) { System.out.close(); return 0; } }", SUM_TESTS, "PrintStream.close");
        refused("class Solution { static int solve(int a, int b) {"
                + " return java.util.ServiceLoader.load(Runnable.class).hashCode(); } }", SUM_TESTS, "not");
    }

    // ---------------------------------------------------------------- starter generation

    @Test
    void starterTypesComeFromTheTests() {
        String s = JavaStarter.build("solve", SUM_TESTS, "function solve(a, b) {\n}");
        assertTrue(s.contains("public static int solve(int a, int b)"), s);

        String arr = JavaStarter.build("solve", "[{\"input\":[[1,2]],\"expected\":[1,4]},{\"input\":[[]],\"expected\":[]}]", null);
        assertTrue(arr.contains("public static int[] solve(int[] a)"), arr);
        assertTrue(arr.contains("return new int[0];"), arr);

        String str = JavaStarter.build("solve", "[{\"input\":[\"ab\"],\"expected\":true}]", "function solve(str) {}");
        assertTrue(str.contains("public static boolean solve(String str)"), str);

        String dbl = JavaStarter.build("avg", "[{\"input\":[[1,2]],\"expected\":1.5}]", null);
        assertTrue(dbl.contains("public static double avg(int[] a)"), dbl);
    }

    @Test
    void generatedStarterCompilesAndRuns() {
        String starter = JavaStarter.build("solve", SUM_TESTS, "function solve(a, b) {}");
        EvalResult r = evaluator.evaluate(starter, "solve", SUM_TESTS);
        assertNull(r.errorMessage); // compiles and runs, just returns 0
        assertEquals(1, r.passedCount); // only 0 + 0 = 0 matches
    }
}
