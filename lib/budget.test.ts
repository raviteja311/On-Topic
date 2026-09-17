import { test, describe, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

/**
 * budget.ts keeps its counter in module state and captures the Pacific day when
 * it loads, so every case gets its own instance through a cache-busting query
 * rather than trying to reset a shared one. The clock is faked before the
 * import for the same reason.
 */

let instances = 0;

type Budget = typeof import("./budget.ts");

async function freshBudget(now: string): Promise<Budget> {
  mock.timers.enable({ apis: ["Date"], now: new Date(now) });
  instances += 1;
  return import(`./budget.ts?case=${instances}`);
}

const NOON_PACIFIC = "2026-03-15T19:00:00Z";

let savedLimit: string | undefined;

beforeEach(() => {
  savedLimit = process.env.SEARCH_DAILY_LIMIT;
  delete process.env.SEARCH_DAILY_LIMIT;
});

afterEach(() => {
  mock.timers.reset();
  if (savedLimit === undefined) delete process.env.SEARCH_DAILY_LIMIT;
  else process.env.SEARCH_DAILY_LIMIT = savedLimit;
});

describe("budgetStatus, counting", () => {
  test("starts at the default limit with nothing used", async () => {
    const { budgetStatus } = await freshBudget(NOON_PACIFIC);
    assert.deepEqual(budgetStatus(), {
      used: 0,
      limit: 60,
      remaining: 60,
      exhausted: false,
    });
  });

  test("each recorded search spends one", async () => {
    const { budgetStatus, recordSearch } = await freshBudget(NOON_PACIFIC);
    recordSearch();
    recordSearch();
    recordSearch();

    const status = budgetStatus();
    assert.equal(status.used, 3);
    assert.equal(status.remaining, 57);
    assert.equal(status.exhausted, false);
  });

  test("exhausts on reaching the limit, not before", async () => {
    process.env.SEARCH_DAILY_LIMIT = "3";
    const { budgetStatus, recordSearch } = await freshBudget(NOON_PACIFIC);

    recordSearch();
    recordSearch();
    assert.equal(budgetStatus().exhausted, false, "two of three is not spent");

    recordSearch();
    assert.equal(budgetStatus().exhausted, true, "three of three is spent");
  });

  test("remaining stops at zero rather than going negative", async () => {
    process.env.SEARCH_DAILY_LIMIT = "2";
    const { budgetStatus, recordSearch } = await freshBudget(NOON_PACIFIC);

    for (let i = 0; i < 5; i += 1) recordSearch();

    const status = budgetStatus();
    assert.equal(status.used, 5);
    assert.equal(status.remaining, 0);
    assert.equal(status.exhausted, true);
  });
});

describe("budgetStatus, reading the limit", () => {
  test("honours SEARCH_DAILY_LIMIT", async () => {
    process.env.SEARCH_DAILY_LIMIT = "5";
    const { budgetStatus } = await freshBudget(NOON_PACIFIC);
    assert.equal(budgetStatus().limit, 5);
  });

  test("floors a fractional limit", async () => {
    process.env.SEARCH_DAILY_LIMIT = "10.7";
    const { budgetStatus } = await freshBudget(NOON_PACIFIC);
    assert.equal(budgetStatus().limit, 10);
  });

  // The stated intent: a malformed value must not silently disable the cap.
  test("falls back to the default on a malformed value", async () => {
    const { budgetStatus } = await freshBudget(NOON_PACIFIC);

    for (const bad of ["abc", "-5", "", "NaN", "Infinity"]) {
      process.env.SEARCH_DAILY_LIMIT = bad;
      assert.equal(
        budgetStatus().limit,
        60,
        `${JSON.stringify(bad)} should fall back to the default`,
      );
    }
  });

  test("treats an explicit zero as a real limit of zero", async () => {
    process.env.SEARCH_DAILY_LIMIT = "0";
    const { budgetStatus } = await freshBudget(NOON_PACIFIC);

    const status = budgetStatus();
    assert.equal(status.limit, 0);
    assert.equal(status.exhausted, true, "nothing is allowed through");
  });

  test("picks the limit up live, without a restart", async () => {
    const { budgetStatus } = await freshBudget(NOON_PACIFIC);
    assert.equal(budgetStatus().limit, 60);

    process.env.SEARCH_DAILY_LIMIT = "12";
    assert.equal(budgetStatus().limit, 12);
  });
});

describe("budgetStatus, the Pacific day window", () => {
  test("clears the count once the Pacific date rolls over", async () => {
    const { budgetStatus, recordSearch } = await freshBudget(NOON_PACIFIC);
    recordSearch();
    recordSearch();
    assert.equal(budgetStatus().used, 2);

    mock.timers.setTime(new Date("2026-03-16T19:00:00Z").getTime());

    assert.equal(budgetStatus().used, 0);
    assert.equal(budgetStatus().remaining, 60);
  });

  /**
   * The point of formatting the day in America/Los_Angeles rather than using
   * the runtime's own date. During PDT the Pacific day changes seven hours
   * after UTC does, so crossing UTC midnight must not reset anything.
   */
  test("does not reset on UTC midnight during PDT", async () => {
    // 13:00 PDT on 14 March.
    const { budgetStatus, recordSearch } = await freshBudget("2026-03-14T20:00:00Z");
    recordSearch();

    // 22:00 PDT, still 14 March in Pacific, but 15 March in UTC.
    mock.timers.setTime(new Date("2026-03-15T05:00:00Z").getTime());
    assert.equal(budgetStatus().used, 1, "same Pacific day, count survives");

    // 01:00 PDT on 15 March, so the Pacific day has finally turned over.
    mock.timers.setTime(new Date("2026-03-15T08:00:00Z").getTime());
    assert.equal(budgetStatus().used, 0);
  });

  test("does not reset on UTC midnight during PST either", async () => {
    // 13:00 PST on 14 January, when the offset is eight hours rather than seven.
    const { budgetStatus, recordSearch } = await freshBudget("2026-01-14T21:00:00Z");
    recordSearch();

    // 22:00 PST, still 14 January in Pacific, 15 January in UTC.
    mock.timers.setTime(new Date("2026-01-15T06:00:00Z").getTime());
    assert.equal(budgetStatus().used, 1, "same Pacific day, count survives");

    // 01:00 PST on 15 January.
    mock.timers.setTime(new Date("2026-01-15T09:00:00Z").getTime());
    assert.equal(budgetStatus().used, 0);
  });

  test("survives the spring forward night with exactly one reset", async () => {
    // 2026 US DST starts on 8 March. 20:00 PST on 7 March.
    const { budgetStatus, recordSearch } = await freshBudget("2026-03-08T04:00:00Z");
    recordSearch();

    // 01:30 PST on 8 March, before the clocks jump. Already a new Pacific day.
    mock.timers.setTime(new Date("2026-03-08T09:30:00Z").getTime());
    assert.equal(budgetStatus().used, 0, "reset once, at the date change");

    recordSearch();

    // 15:00 PDT the same day, after the jump. Still 8 March, so no second reset.
    mock.timers.setTime(new Date("2026-03-08T22:00:00Z").getTime());
    assert.equal(budgetStatus().used, 1, "the offset change is not a date change");
  });
});
