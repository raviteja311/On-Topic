/**
 * A hard local cap on how many searches are allowed to reach the API in a day.
 *
 * The Google quota is the real limit, but it fails late and bluntly: you get
 * 403s for the rest of the day once it is gone, with no warning as you approach
 * it. This counter stops us short of that on purpose, so the failure is ours,
 * is predictable, and can explain itself.
 *
 * The window resets at midnight Pacific, which is when the Google quota resets,
 * so the two stay in step through daylight saving without any date arithmetic
 * on our side.
 *
 * Like the cache, this is process-local by design. Two consequences worth
 * knowing: a restart clears the count, and a multi-instance deployment gets the
 * limit per instance rather than in total. That makes this a guard against
 * ordinary runaway usage, not a guarantee against a determined caller.
 */

const DEFAULT_LIMIT = 60;

/** Locale-independent YYYY-MM-DD, so the key cannot shift with the runtime's locale. */
const dayParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Exported so the per-visitor limit resets on exactly the same boundary. */
export function pacificDay(): string {
  const parts = dayParts.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function readLimit(): number {
  const raw = process.env.SEARCH_DAILY_LIMIT;
  if (!raw) return DEFAULT_LIMIT;
  const n = Number(raw);
  // A malformed value should not silently disable the cap.
  if (!Number.isFinite(n) || n < 0) return DEFAULT_LIMIT;
  return Math.floor(n);
}

let day = pacificDay();
let used = 0;

/** Zeroes the count when the Pacific date has rolled over. */
function roll(): void {
  const today = pacificDay();
  if (today !== day) {
    day = today;
    used = 0;
  }
}

export interface BudgetStatus {
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
}

export function budgetStatus(): BudgetStatus {
  roll();
  const limit = readLimit();
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    exhausted: used >= limit,
  };
}

/**
 * Counted before the request goes out, not after it comes back, because the
 * quota is spent the moment Google receives the call. A request that dies in
 * the network still burns a slot here, which overcounts by one in a rare case.
 * That is the safe direction to be wrong in for a spend limit.
 */
export function recordSearch(): void {
  roll();
  used += 1;
}
