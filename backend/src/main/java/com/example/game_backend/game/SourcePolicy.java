package com.example.game_backend.game;

import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.IdentifierTree;
import com.sun.source.tree.LineMap;
import com.sun.source.tree.MemberReferenceTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePath;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.Trees;

import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.PackageElement;
import javax.lang.model.element.TypeElement;
import java.util.HashSet;
import java.util.Set;

/**
 * First line of defence for player code (the second is the locked-down child JVM): after javac has
 * resolved every name, each referenced class, method and field must be on an allowlist. Players get
 * java.lang basics, java.util (+ function, stream), java.math and printing to System.out. Files,
 * network, processes, threads, reflection, class loading, System.exit / getenv / properties are refused.
 */
final class SourcePolicy {

    /** Packages whose classes are allowed, minus BLOCKED_TYPES. */
    private static final Set<String> OPEN_PACKAGES = Set.of("java.util", "java.util.function", "java.util.stream", "java.math");

    /** Packages that may appear in a qualified name or import on the way to an allowed class. */
    private static final Set<String> PATH_PACKAGES = Set.of("java", "java.lang", "java.util", "java.util.function", "java.util.stream", "java.math");

    /** java.lang is mostly dangerous, so only these classes are allowed there. */
    private static final Set<String> LANG_TYPES = Set.of(
            "Object", "String", "StringBuilder", "StringBuffer", "CharSequence", "Math", "StrictMath",
            "Integer", "Long", "Short", "Byte", "Double", "Float", "Boolean", "Character", "Number",
            "Comparable", "Iterable", "Cloneable", "AutoCloseable", "Enum", "Record", "Void",
            "Override", "Deprecated", "SuppressWarnings", "FunctionalInterface", "SafeVarargs",
            "Throwable", "Exception", "RuntimeException", "Error",
            "ArithmeticException", "ArrayIndexOutOfBoundsException", "IndexOutOfBoundsException",
            "StringIndexOutOfBoundsException", "IllegalArgumentException", "IllegalStateException",
            "NullPointerException", "NumberFormatException", "UnsupportedOperationException",
            "ClassCastException", "NegativeArraySizeException", "CloneNotSupportedException",
            "StackOverflowError", "AssertionError",
            // System only for System.out / System.err (see FIELD_ONLY), PrintStream only for printing
            "System");

    private static final Set<String> BLOCKED_TYPES = Set.of(
            "java.util.ServiceLoader", "java.util.Timer", "java.util.TimerTask", "java.util.Formatter",
            "java.util.ResourceBundle", "java.util.PropertyResourceBundle", "java.util.ListResourceBundle",
            "java.util.Properties", "java.util.Scanner", "java.util.SplittableRandom");

    /** Method names refused on every class (reflection handles, threads, system properties). */
    private static final Set<String> BLOCKED_METHODS = Set.of(
            "getClass", "getDeclaringClass", "wait", "notify", "notifyAll", "finalize",
            "getInteger", "getLong", "getBoolean", "parallelStream", "parallel");

    private static final Set<String> PRINT_METHODS = Set.of("print", "println", "printf", "format", "flush");

    private SourcePolicy() {
    }

    /** Returns null when the code is acceptable, otherwise a message for the player. */
    static String check(Iterable<? extends CompilationUnitTree> units, Trees trees) {
        for (CompilationUnitTree unit : units) {
            Set<String> own = new HashSet<>();
            for (Tree t : unit.getTypeDecls()) {
                if (t instanceof ClassTree) {
                    own.add(((ClassTree) t).getSimpleName().toString());
                }
            }
            if (unit.getPackageName() != null) {
                return "Remove the 'package' line: write just class Solution { ... }";
            }
            Scanner scanner = new Scanner(trees, unit, own);
            scanner.scan(unit, null);
            if (scanner.problem != null) {
                return scanner.problem;
            }
        }
        return null;
    }

    private static final class Scanner extends TreePathScanner<Void, Void> {
        private final Trees trees;
        private final CompilationUnitTree unit;
        private final Set<String> ownTopLevel;
        String problem;

        Scanner(Trees trees, CompilationUnitTree unit, Set<String> ownTopLevel) {
            this.trees = trees;
            this.unit = unit;
            this.ownTopLevel = ownTopLevel;
        }

        @Override
        public Void scan(Tree tree, Void unused) {
            return problem != null ? null : super.scan(tree, unused);
        }

        @Override
        public Void visitMethod(MethodTree node, Void unused) {
            if (node.getModifiers().getFlags().contains(Modifier.NATIVE)) {
                fail(node, "native methods are not allowed");
                return null;
            }
            return super.visitMethod(node, unused);
        }

        @Override
        public Void visitIdentifier(IdentifierTree node, Void unused) {
            inspect(node, node.getName().toString());
            return super.visitIdentifier(node, unused);
        }

        @Override
        public Void visitMemberSelect(MemberSelectTree node, Void unused) {
            String name = node.getIdentifier().toString();
            if (name.equals("class")) {
                fail(node, "class literals (X.class) are not allowed");
                return null;
            }
            inspect(node, name);
            return super.visitMemberSelect(node, unused);
        }

        @Override
        public Void visitMemberReference(MemberReferenceTree node, Void unused) {
            inspect(node, node.getName().toString());
            return super.visitMemberReference(node, unused);
        }

        private void inspect(Tree node, String name) {
            if (problem != null) {
                return;
            }
            Element e = trees.getElement(getCurrentPath());
            if (e == null) {
                return; // e.g. labels; javac already rejected unresolved names
            }
            String why = verdict(e);
            if (why != null) {
                fail(node, why);
            }
        }

        private String verdict(Element e) {
            switch (e.getKind()) {
                case PACKAGE: {
                    String p = ((PackageElement) e).getQualifiedName().toString();
                    return PATH_PACKAGES.contains(p) ? null : "package " + p + " is not available";
                }
                case LOCAL_VARIABLE:
                case PARAMETER:
                case EXCEPTION_PARAMETER:
                case RESOURCE_VARIABLE:
                case BINDING_VARIABLE:
                case TYPE_PARAMETER:
                    return null;
                default:
                    break;
            }
            if (e instanceof TypeElement) {
                return typeVerdict((TypeElement) e);
            }
            // a method, constructor or field: judged by the class that declares it
            Element owner = e.getEnclosingElement();
            if (!(owner instanceof TypeElement)) {
                return null;
            }
            TypeElement type = (TypeElement) owner;
            String name = e.getSimpleName().toString();
            if (isOwn(type)) {
                return null;
            }
            // javac models array members (nums.length, nums.clone()) as members of a synthetic class "Array"
            // without a package; nothing else can name it, so these two are plain array operations.
            if (isArrayPseudoClass(type)) {
                return (name.equals("length") && e.getKind() == ElementKind.FIELD)
                        || (name.equals("clone") && e.getKind() == ElementKind.METHOD)
                        ? null : "array." + name + " is not allowed";
            }
            String typeWhy = typeVerdict(type);
            if (typeWhy != null) {
                return typeWhy;
            }
            if (e.getKind() == ElementKind.METHOD && BLOCKED_METHODS.contains(name)) {
                return name + "() is not allowed";
            }
            if (e.getKind() == ElementKind.METHOD && name.startsWith("parallel")) {
                return name + "() is not allowed (no threads)";
            }
            String q = type.getQualifiedName().toString();
            if (q.equals("java.lang.System")) {
                if (e.getKind() == ElementKind.FIELD && (name.equals("out") || name.equals("err"))) {
                    return null;
                }
                return "System." + name + " is not allowed (only System.out / System.err)";
            }
            if (q.equals("java.io.PrintStream")) {
                return e.getKind() == ElementKind.METHOD && PRINT_METHODS.contains(name)
                        ? null : "PrintStream." + name + " is not allowed";
            }
            return null;
        }

        private String typeVerdict(TypeElement type) {
            if (isOwn(type)) {
                return null;
            }
            String q = type.getQualifiedName().toString();
            if (q.equals("java.io.PrintStream")) {
                return null; // reached only through System.out; its methods are filtered above
            }
            TypeElement top = outermost(type);
            String topName = top.getQualifiedName().toString();
            String pkg = packageOf(top);
            if (pkg.equals("java.lang")) {
                return LANG_TYPES.contains(top.getSimpleName().toString()) ? null : simple(q) + " is not available";
            }
            if (OPEN_PACKAGES.contains(pkg) && !BLOCKED_TYPES.contains(topName)) {
                return null;
            }
            return simple(q) + " is not available";
        }

        private boolean isArrayPseudoClass(TypeElement type) {
            return type.getQualifiedName().contentEquals("Array") && !ownTopLevel.contains("Array")
                    && !(type.getEnclosingElement() instanceof TypeElement);
        }

        private boolean isOwn(TypeElement type) {
            TypeElement top = outermost(type);
            return packageOf(top).isEmpty() && ownTopLevel.contains(top.getSimpleName().toString());
        }

        private static TypeElement outermost(TypeElement t) {
            Element cur = t;
            while (cur.getEnclosingElement() instanceof TypeElement) {
                cur = cur.getEnclosingElement();
            }
            return (TypeElement) cur;
        }

        private static String packageOf(TypeElement top) {
            Element p = top.getEnclosingElement();
            return p instanceof PackageElement ? ((PackageElement) p).getQualifiedName().toString() : "";
        }

        private static String simple(String q) {
            return q.startsWith("java.") ? q.substring(q.lastIndexOf('.') + 1) : q;
        }

        private void fail(Tree node, String why) {
            if (problem != null) {
                return;
            }
            long pos = trees.getSourcePositions().getStartPosition(unit, node);
            LineMap lines = unit.getLineMap();
            String where = pos >= 0 && lines != null ? "Line " + lines.getLineNumber(pos) + ": " : "";
            problem = where + why;
        }
    }
}
