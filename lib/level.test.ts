import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { inferLevel, LEVEL_LABEL } from "./level.ts";

describe("inferLevel, from the title", () => {
  test("picks beginner from beginner words", () => {
    assert.equal(inferLevel("Python for beginners", "").level, "beginner");
    assert.equal(inferLevel("Getting started with Docker", "").level, "beginner");
    assert.equal(inferLevel("Rust crash course", "").level, "beginner");
    assert.equal(inferLevel("Linear algebra 101", "").level, "beginner");
  });

  test("picks advanced from advanced words", () => {
    assert.equal(inferLevel("Advanced type systems", "").level, "advanced");
    assert.equal(inferLevel("A deep dive into the GC", "").level, "advanced");
    assert.equal(inferLevel("Postgres internals", "").level, "advanced");
    assert.equal(inferLevel("Running Kafka at scale", "").level, "advanced");
  });

  test("picks intermediate from intermediate words", () => {
    assert.equal(inferLevel("Build a URL shortener", "").level, "intermediate");
    assert.equal(inferLevel("Real world React patterns", "").level, "intermediate");
  });

  test("ignores case", () => {
    assert.equal(inferLevel("ADVANCED RUST", "").level, "advanced");
    assert.equal(inferLevel("For Beginners", "").level, "beginner");
  });
});

describe("inferLevel, title against description", () => {
  // The documented reason for the 3x weighting: a description often lists a
  // whole course ("beginner to advanced") and would otherwise match everything.
  test("a title match outweighs several description matches", () => {
    const { level } = inferLevel(
      "Advanced Rust",
      "Covers the basics and the fundamentals too",
    );
    assert.equal(level, "advanced");
  });

  test("a description still decides when the title says nothing", () => {
    assert.equal(
      inferLevel("Rust ownership", "A beginner guide to the language").level,
      "beginner",
    );
  });

  test("only the first 400 characters of the description count", () => {
    const buried = `${"filler words ".repeat(40)} for beginners`;
    assert.ok(buried.indexOf("for beginners") > 400);
    assert.equal(inferLevel("Rust ownership", buried).level, "intermediate");
  });
});

describe("inferLevel, the default", () => {
  test("falls back to intermediate when nothing matches", () => {
    const result = inferLevel("Rust ownership", "A talk about the borrow checker");
    assert.equal(result.level, "intermediate");
    assert.deepEqual(result.signals, []);
  });
});

describe("inferLevel, signals", () => {
  test("reports the words that produced the guess", () => {
    const { signals } = inferLevel("Docker for beginners", "");
    assert.ok(signals.includes("beginner"));
  });

  test("caps the list at four", () => {
    const { signals } = inferLevel(
      "Beginner basics fundamentals crash course 101 first steps",
      "",
    );
    assert.equal(signals.length, 4);
  });

  test("does not repeat a word matched in both title and description", () => {
    const { signals } = inferLevel("Advanced Rust", "An advanced treatment");
    assert.deepEqual(
      signals.filter((s) => s === "advanced").length,
      1,
    );
  });
});

describe("inferLevel, tie breaking", () => {
  // "intro to" scores beginner 3 and "internals" scores advanced 3, so the
  // words found disagree and neither should win on key order alone.
  test("a tie falls back to intermediate", () => {
    assert.equal(inferLevel("Intro to internals", "").level, "intermediate");
  });

  test("a tie still reports the words that disagreed", () => {
    const { signals } = inferLevel("Intro to internals", "");
    assert.deepEqual(signals, ["intro to", "internals"]);
  });

  test("a clear winner is unaffected", () => {
    assert.equal(inferLevel("Advanced internals deep dive", "").level, "advanced");
    assert.equal(inferLevel("Beginner basics, getting started", "").level, "beginner");
  });

  // Intermediate winning outright is not the same as the fallback, and the
  // signals are what tell the two apart.
  test("intermediate winning outright still reports its signals", () => {
    const { level, signals } = inferLevel("Build a real world project", "");
    assert.equal(level, "intermediate");
    assert.ok(signals.length > 0);
  });
});

describe("LEVEL_LABEL", () => {
  test("gives a display label for every level", () => {
    assert.deepEqual(LEVEL_LABEL, {
      beginner: "Beginner",
      intermediate: "Intermediate",
      advanced: "Advanced",
    });
  });
});
