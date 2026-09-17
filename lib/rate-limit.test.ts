import { test, describe, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

/**
 * Like budget.ts, this keeps counts in module state and captures the Pacific
 * day when it loads, so every case gets its own instance through a
 * cache-busting query with the clock faked before the import.
 */

let instances = 0;

type RateLimit = typeof import("./rate-limit.ts");

async function freshLimiter(now: string): Promise<RateLimit> {
  mock.timers.enable({ apis: ["Date"], now: new Date(now) });
  instances += 1;
  return import(`./rate-limit.ts?case=${instances}`);
}

const NOON_PACIFIC = "2026-03-15T19:00:00Z";

/** Stands in for the Headers object the page passes in. */
function headers(values: Record<string, string>) {
  return { get: (name: string) => values[name] ?? null };
}

let savedLimit: string | undefined;

beforeEach(() => {
  savedLimit = process.env.SEARCH_VISITOR_LIMIT;
  delete process.env.SEARCH_VISITOR_LIMIT;
});

afterEach(() => {
  mock.timers.reset();
  if (savedLimit === undefined) delete process.env.SEARCH_VISITOR_LIMIT;
  else process.env.SEARCH_VISITOR_LIMIT = savedLimit;
});

describe("visitorKey", () => {
  test("takes the leftmost x-forwarded-for entry", async () => {
    const { visitorKey } = await freshLimiter(NOON_PACIFIC);

    const direct = visitorKey(headers({ "x-forwarded-for": "203.0.113.7" }));
    const chained = visitorKey(
      headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" }),
    );

    assert.equal(direct, chained, "the client is the first entry, proxies follow");
  });

  test("tolerates the spacing proxies actually use", async () => {
    const { visitorKey } = await freshLimiter(NOON_PACIFIC);
    assert.equal(
      visitorKey(headers({ "x-forwarded-for": "  203.0.113.7  ,70.41.3.18" })),
      visitorKey(headers({ "x-forwarded-for": "203.0.113.7" })),
    );
  });

  test("falls back to x-real-ip", async () => {
    const { visitorKey } = await freshLimiter(NOON_PACIFIC);
    assert.equal(
      visitorKey(headers({ "x-real-ip": "203.0.113.7" })),
      visitorKey(headers({ "x-forwarded-for": "203.0.113.7" })),
    );
  });

  test("returns null when no proxy said who is asking", async () => {
    const { visitorKey } = await freshLimiter(NOON_PACIFIC);
    assert.equal(visitorKey(headers({})), null);
    assert.equal(visitorKey(headers({ "x-forwarded-for": "" })), null);
    assert.equal(visitorKey(headers({ "x-forwarded-for": "   " })), null);
  });

  test("separates different addresses", async () => {
    const { visitorKey } = await freshLimiter(NOON_PACIFIC);
    assert.notEqual(
      visitorKey(headers({ "x-forwarded-for": "203.0.113.7" })),
      visitorKey(headers({ "x-forwarded-for": "203.0.113.8" })),
    );
  });

  // The address is hashed with a per-process salt so it is never kept.
  test("does not return the address itself", async () => {
    const { visitorKey } = await freshLimiter(NOON_PACIFIC);
    const key = visitorKey(headers({ "x-forwarded-for": "203.0.113.7" }));
    assert.ok(key);
    assert.ok(!key.includes("203.0.113.7"));
    assert.ok(!key.includes("203"));
  });
});

describe("visitorStatus, counting", () => {
  test("starts at the default share", async () => {
    const { visitorStatus } = await freshLimiter(NOON_PACIFIC);
    assert.deepEqual(visitorStatus("someone"), {
      used: 0,
      limit: 15,
      remaining: 15,
      exhausted: false,
    });
  });

  test("spends one per recorded search", async () => {
    const { visitorStatus, recordVisitorSearch } = await freshLimiter(NOON_PACIFIC);
    recordVisitorSearch("someone");
    recordVisitorSearch("someone");

    const status = visitorStatus("someone");
    assert.equal(status.used, 2);
    assert.equal(status.remaining, 13);
  });

  test("exhausts on reaching the share, not before", async () => {
    process.env.SEARCH_VISITOR_LIMIT = "2";
    const { visitorStatus, recordVisitorSearch } = await freshLimiter(NOON_PACIFIC);

    recordVisitorSearch("someone");
    assert.equal(visitorStatus("someone").exhausted, false);

    recordVisitorSearch("someone");
    assert.equal(visitorStatus("someone").exhausted, true);
  });

  // The whole point of the module: one heavy visitor must not spend the day.
  test("keeps visitors independent of each other", async () => {
    process.env.SEARCH_VISITOR_LIMIT = "2";
    const { visitorStatus, recordVisitorSearch } = await freshLimiter(NOON_PACIFIC);

    recordVisitorSearch("heavy");
    recordVisitorSearch("heavy");
    assert.equal(visitorStatus("heavy").exhausted, true);

    assert.equal(visitorStatus("someone else").used, 0);
    assert.equal(
      visitorStatus("someone else").exhausted,
      false,
      "one visitor spending their share must not refuse anybody else",
    );
  });

  test("remaining stops at zero", async () => {
    process.env.SEARCH_VISITOR_LIMIT = "1";
    const { visitorStatus, recordVisitorSearch } = await freshLimiter(NOON_PACIFIC);

    recordVisitorSearch("someone");
    recordVisitorSearch("someone");
    recordVisitorSearch("someone");

    assert.equal(visitorStatus("someone").remaining, 0);
  });
});

describe("visitorStatus, reading the limit", () => {
  test("honours SEARCH_VISITOR_LIMIT", async () => {
    process.env.SEARCH_VISITOR_LIMIT = "4";
    const { visitorStatus } = await freshLimiter(NOON_PACIFIC);
    assert.equal(visitorStatus("someone").limit, 4);
  });

  test("falls back to the default on a malformed value", async () => {
    const { visitorStatus } = await freshLimiter(NOON_PACIFIC);

    for (const bad of ["abc", "-1", "", "NaN"]) {
      process.env.SEARCH_VISITOR_LIMIT = bad;
      assert.equal(
        visitorStatus("someone").limit,
        15,
        `${JSON.stringify(bad)} should fall back to the default`,
      );
    }
  });

  test("floors a fractional share", async () => {
    process.env.SEARCH_VISITOR_LIMIT = "7.9";
    const { visitorStatus } = await freshLimiter(NOON_PACIFIC);
    assert.equal(visitorStatus("someone").limit, 7);
  });
});

describe("visitorStatus, the Pacific day window", () => {
  test("clears every count when the Pacific date turns over", async () => {
    const { visitorStatus, recordVisitorSearch } = await freshLimiter(NOON_PACIFIC);
    recordVisitorSearch("someone");
    recordVisitorSearch("another");
    assert.equal(visitorStatus("someone").used, 1);

    mock.timers.setTime(new Date("2026-03-16T19:00:00Z").getTime());

    assert.equal(visitorStatus("someone").used, 0);
    assert.equal(visitorStatus("another").used, 0);
  });

  // Resets on the same boundary as budget.ts, which is why it shares its day.
  test("does not reset on UTC midnight", async () => {
    // 13:00 PDT on 14 March.
    const { visitorStatus, recordVisitorSearch } = await freshLimiter(
      "2026-03-14T20:00:00Z",
    );
    recordVisitorSearch("someone");

    // 22:00 PDT, still 14 March in Pacific but 15 March in UTC.
    mock.timers.setTime(new Date("2026-03-15T05:00:00Z").getTime());
    assert.equal(visitorStatus("someone").used, 1);

    // 01:00 PDT on 15 March.
    mock.timers.setTime(new Date("2026-03-15T08:00:00Z").getTime());
    assert.equal(visitorStatus("someone").used, 0);
  });
});
