package com.example.game_backend.game;

import com.example.game_backend.entity.Challenge;
import com.example.game_backend.repository.ChallengeRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Publishes a starter catalog of EASY challenges when the table is empty. */
@Component
public class ChallengeSeeder implements ApplicationRunner {
    private final ChallengeRepository repository;

    public ChallengeSeeder(ChallengeRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (repository.count() > 0) {
            return;
        }
        add("GATE // NEURAL SUM", "Write a function `solve(a, b)` that returns the sum of two integers.",
                "Two integers `a` and `b` (-1000 <= a, b <= 1000).", "The integer a + b.",
                "function solve(a, b) {\n  // TODO: return the sum of a and b\n\n}\n",
                "solve(3, 7) -> 10\nsolve(-5, 12) -> 7",
                "[{\"input\":[3,7],\"expected\":10},{\"input\":[-5,12],\"expected\":7},{\"input\":[0,0],\"expected\":0},{\"input\":[99,-99],\"expected\":0},{\"input\":[1000,1000],\"expected\":2000}]");
        add("GATE // CYBER MIRROR", "Write a function `solve(str)` that returns true if the string reads the same forwards and backwards, otherwise false.",
                "A lowercase alphanumeric string `str`.", "Boolean true or false.",
                "function solve(str) {\n  // TODO: return true if str is a palindrome\n\n}\n",
                "solve(\"racecar\") -> true\nsolve(\"neon\") -> false",
                "[{\"input\":[\"racecar\"],\"expected\":true},{\"input\":[\"neon\"],\"expected\":false},{\"input\":[\"radar\"],\"expected\":true},{\"input\":[\"pixelcode\"],\"expected\":false},{\"input\":[\"a\"],\"expected\":true},{\"input\":[\"ab\"],\"expected\":false}]");
        add("GATE // MAX SIGNAL", "Write a function `solve(nums)` that returns the largest number in an array.",
                "An array of numbers `nums` (length >= 1).", "The maximum number in the array.",
                "function solve(nums) {\n  // TODO: return the largest number\n\n}\n",
                "solve([1, 5, 3, 9, 2]) -> 9\nsolve([-10, -50, -2, -99]) -> -2",
                "[{\"input\":[[1,5,3,9,2]],\"expected\":9},{\"input\":[[-10,-50,-2,-99]],\"expected\":-2},{\"input\":[[42]],\"expected\":42},{\"input\":[[7,7,7]],\"expected\":7},{\"input\":[[0,-1,100,99]],\"expected\":100}]");
        add("GATE // DATA REVERSAL", "Write a function `solve(str)` that returns the string reversed.",
                "A string `str`.", "The reversed string.",
                "function solve(str) {\n  // TODO: return str reversed\n\n}\n",
                "solve(\"cyber\") -> \"rebyc\"\nsolve(\"12345\") -> \"54321\"",
                "[{\"input\":[\"cyber\"],\"expected\":\"rebyc\"},{\"input\":[\"12345\"],\"expected\":\"54321\"},{\"input\":[\"a\"],\"expected\":\"a\"},{\"input\":[\"world\"],\"expected\":\"dlrow\"},{\"input\":[\"\"],\"expected\":\"\"}]");
        add("GATE // VOWEL SCAN", "Write a function `solve(str)` that counts the vowels (a, e, i, o, u) in a lowercase string.",
                "A lowercase string `str`.", "The number of vowels.",
                "function solve(str) {\n  // TODO: count the vowels\n\n}\n",
                "solve(\"pixel\") -> 2\nsolve(\"rhythm\") -> 0",
                "[{\"input\":[\"pixel\"],\"expected\":2},{\"input\":[\"rhythm\"],\"expected\":0},{\"input\":[\"aeiou\"],\"expected\":5},{\"input\":[\"\"],\"expected\":0},{\"input\":[\"neon code\"],\"expected\":4}]");
        add("GATE // ARRAY TOTAL", "Write a function `solve(nums)` that returns the sum of all numbers in an array.",
                "An array of integers `nums` (may be empty).", "The sum of all elements (0 for an empty array).",
                "function solve(nums) {\n  // TODO: return the sum of the array\n\n}\n",
                "solve([1, 2, 3]) -> 6\nsolve([]) -> 0",
                "[{\"input\":[[1,2,3]],\"expected\":6},{\"input\":[[]],\"expected\":0},{\"input\":[[-4,4]],\"expected\":0},{\"input\":[[10,20,30,40]],\"expected\":100},{\"input\":[[5]],\"expected\":5}]");
        add("GATE // PARITY LOCK", "Write a function `solve(n)` that returns true if the integer is even, otherwise false.",
                "An integer `n` (-1000 <= n <= 1000).", "Boolean true or false.",
                "function solve(n) {\n  // TODO: return true when n is even\n\n}\n",
                "solve(4) -> true\nsolve(7) -> false",
                "[{\"input\":[4],\"expected\":true},{\"input\":[7],\"expected\":false},{\"input\":[0],\"expected\":true},{\"input\":[-3],\"expected\":false},{\"input\":[-8],\"expected\":true}]");
        add("GATE // FIZZ PROTOCOL", "Write a function `solve(n)` that returns \"FizzBuzz\" if n is divisible by 3 and 5, \"Fizz\" if divisible by 3, \"Buzz\" if divisible by 5, otherwise the number as a string.",
                "A positive integer `n`.", "A string.",
                "function solve(n) {\n  // TODO: FizzBuzz for a single number\n\n}\n",
                "solve(15) -> \"FizzBuzz\"\nsolve(7) -> \"7\"",
                "[{\"input\":[15],\"expected\":\"FizzBuzz\"},{\"input\":[7],\"expected\":\"7\"},{\"input\":[9],\"expected\":\"Fizz\"},{\"input\":[10],\"expected\":\"Buzz\"},{\"input\":[1],\"expected\":\"1\"},{\"input\":[30],\"expected\":\"FizzBuzz\"}]");
        add("GATE // FACTORIAL CORE", "Write a function `solve(n)` that returns n! (the factorial of n). 0! is 1.",
                "An integer `n` (0 <= n <= 10).", "The factorial of n.",
                "function solve(n) {\n  // TODO: return n factorial\n\n}\n",
                "solve(5) -> 120\nsolve(0) -> 1",
                "[{\"input\":[5],\"expected\":120},{\"input\":[0],\"expected\":1},{\"input\":[1],\"expected\":1},{\"input\":[3],\"expected\":6},{\"input\":[10],\"expected\":3628800}]");
        add("GATE // SQUARE GRID", "Write a function `solve(nums)` that returns a new array with every number squared.",
                "An array of integers `nums` (may be empty).", "An array of the squares, in the same order.",
                "function solve(nums) {\n  // TODO: return the squares of nums\n\n}\n",
                "solve([1, 2, 3]) -> [1,4,9]\nsolve([]) -> []",
                "[{\"input\":[[1,2,3]],\"expected\":[1,4,9]},{\"input\":[[]],\"expected\":[]},{\"input\":[[-2,5]],\"expected\":[4,25]},{\"input\":[[10]],\"expected\":[100]},{\"input\":[[0,0]],\"expected\":[0,0]}]");
    }

    private void add(String title, String description, String in, String out, String starter, String examples, String tests) {
        Challenge c = new Challenge();
        c.setTitle(title);
        c.setDescription(description);
        c.setInputDescription(in);
        c.setOutputDescription(out);
        c.setFunctionName("solve");
        c.setStarterCode(starter);
        c.setExamples(examples);
        c.setTestsJson(tests);
        c.setDifficulty("EASY");
        c.setPublished(true);
        repository.save(c);
    }
}
