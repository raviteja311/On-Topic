import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatDuration,
  formatExactDate,
  formatPublished,
  parseIsoDuration,
  spokenDuration,
} from "./duration.ts";

describe("parseIsoDuration", () => {
  test("reads hours, minutes and seconds", () => {
    assert.equal(parseIsoDuration("PT1H4M12S"), 3852);
    assert.equal(parseIsoDuration("PT15M"), 900);
    assert.equal(parseIsoDuration("PT45S"), 45);
    assert.equal(parseIsoDuration("PT2H"), 7200);
  });

  test("reads the day component", () => {
    assert.equal(parseIsoDuration("P1DT2H30M"), 86400 + 7200 + 1800);
  });

  // The case the module comment calls out: a live stream has no fixed length.
  test("returns 0 for a live stream", () => {
    assert.equal(parseIsoDuration("P0D"), 0);
  });

  test("returns 0 rather than throwing on missing or malformed input", () => {
    assert.equal(parseIsoDuration(undefined), 0);
    assert.equal(parseIsoDuration(""), 0);
    assert.equal(parseIsoDuration("not a duration"), 0);
    assert.equal(parseIsoDuration("1H4M"), 0);
  });
});

describe("formatDuration", () => {
  test("drops the hour segment under an hour", () => {
    assert.equal(formatDuration(247), "4:07");
    assert.equal(formatDuration(59), "0:59");
  });

  test("keeps the hour segment over an hour, zero padded", () => {
    assert.equal(formatDuration(3847), "1:04:07");
    assert.equal(formatDuration(36000), "10:00:00");
  });

  test("calls a zero length video live, since that is what 0 means here", () => {
    assert.equal(formatDuration(0), "Live");
  });
});

describe("spokenDuration", () => {
  // Exists because a screen reader reads 1:04:07 as a time of day otherwise.
  test("spells out hours and minutes", () => {
    assert.equal(spokenDuration(3847), "1 hour 4 minutes");
    assert.equal(spokenDuration(7320), "2 hours 2 minutes");
  });

  test("uses the singular for one", () => {
    assert.equal(spokenDuration(3600), "1 hour");
    assert.equal(spokenDuration(60), "1 minute");
  });

  test("falls back to seconds when there is no whole minute", () => {
    assert.equal(spokenDuration(20), "20 seconds");
  });

  test("matches the live label", () => {
    assert.equal(spokenDuration(0), "Live stream");
  });
});

describe("formatPublished", () => {
  const now = new Date("2026-09-17T12:00:00Z");
  const daysAgo = (n: number) =>
    new Date(now.getTime() - n * 86400000).toISOString();

  test("names today and yesterday", () => {
    assert.equal(formatPublished(daysAgo(0), now), "Today");
    assert.equal(formatPublished(daysAgo(1), now), "Yesterday");
  });

  test("counts days under a month", () => {
    assert.equal(formatPublished(daysAgo(5), now), "5 days ago");
    assert.equal(formatPublished(daysAgo(29), now), "29 days ago");
  });

  test("switches to months, then to years", () => {
    assert.equal(formatPublished(daysAgo(30), now), "1 month ago");
    assert.equal(formatPublished(daysAgo(90), now), "3 months ago");
    assert.equal(formatPublished(daysAgo(400), now), "1 year ago");
    assert.equal(formatPublished(daysAgo(800), now), "2 years ago");
  });

  test("treats a future date as today rather than going negative", () => {
    assert.equal(formatPublished(daysAgo(-3), now), "Today");
  });

  test("returns an empty string for an unparseable date", () => {
    assert.equal(formatPublished("", now), "");
    assert.equal(formatPublished("not a date", now), "");
  });
});

describe("formatExactDate", () => {
  test("produces a date containing the year", () => {
    const formatted = formatExactDate("2026-09-17T12:00:00Z");
    assert.notEqual(formatted, "");
    assert.match(formatted, /2026/);
  });

  // Locale decides the wording, so only the failure case is asserted exactly.
  test("returns an empty string for an unparseable date", () => {
    assert.equal(formatExactDate(""), "");
    assert.equal(formatExactDate("not a date"), "");
  });
});
