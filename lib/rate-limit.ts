import { createHash, randomBytes } from "node:crypto";

// Explicit extension, unlike the rest of lib/, because this module is imported
// by a test that Node loads directly and Node's resolver will not guess it.
import { pacificDay } from "./budget.ts";

/**
 * A per-visitor share of the daily budget.
 *
 * budget.ts caps what the whole deployment spends in a day, which on its own is
 * first come first served: one person refreshing with varied topics can spend
 * the day's searches and everyone arriving after them gets the refusal. This
 * splits that cap so no single visitor can do it.
 *
 * It is a fairness mechanism, not a security control. A visitor is whoever the
 * platform's proxy says they are, so anyone able to vary that address can help
 * themselves to another share. The global cap is what actually bounds the
 * spend. This only decides who gets to use it.
 *
 * Process-local for the same reasons as budget.ts and cache.ts: a restart
 * clears the counts, and a multi-instance deployment applies the share per
 * instance rather than in total.
 */

const DEFAULT_LIMIT = 15;

/**
 * Bounds the table, because the number of distinct addresses is not ours to
 * control. Past this the oldest entry goes, which forgives whoever it belonged
 * to. That is the wrong direction to be wrong in, but an unbounded map is
 * worse, and the global cap still backstops the spend.
 */
const MAX_VISITORS = 5000;

/**
 * Addresses are never stored. The salt is generated at startup and dies with
 * the process, so the table cannot be checked against a guessed address even by
 * something that can read the memory it lives in.
 */
const SALT = randomBytes(32);

function fingerprint(address: string): string {
  return createHash("sha256")
    .update(SALT)
    .update(address)
    .digest("base64url")
    .slice(0, 22);
}

/**
 * The leftmost x-forwarded-for entry is the client as the platform's edge saw
 * it, which is only worth trusting because a proxy in front of us rewrites that
 * header on the way in. Without such a proxy there is no address worth acting
 * on, so the caller goes unlimited and the global cap is the only thing left.
 *
 * Takes the header bag rather than calling headers() itself, so the parsing can
 * be tested without a request.
 */
export function visitorKey(source: {
  get(name: string): string | null;
}): string | null {
  const forwarded = source.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || source.get("x-real-ip")?.trim() || "";
  return address ? fingerprint(address) : null;
}

function readLimit(): number {
  const raw = process.env.SEARCH_VISITOR_LIMIT;
  if (!raw) return DEFAULT_LIMIT;
  const n = Number(raw);
  // A malformed value should not silently remove the share, same as budget.ts.
  if (!Number.isFinite(n) || n < 0) return DEFAULT_LIMIT;
  return Math.floor(n);
}

const visitors = new Map<string, number>();
let day = pacificDay();

/** Drops every count at once when the Pacific date turns over, in step with budget.ts. */
function roll(): void {
  const today = pacificDay();
  if (today !== day) {
    day = today;
    visitors.clear();
  }
}

export interface VisitorStatus {
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
}

export function visitorStatus(key: string): VisitorStatus {
  roll();
  const limit = readLimit();
  const used = visitors.get(key) ?? 0;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    exhausted: used >= limit,
  };
}

/** Counted before the request goes out, for the same reason budget.ts does it. */
export function recordVisitorSearch(key: string): void {
  roll();
  if (!visitors.has(key) && visitors.size >= MAX_VISITORS) {
    // Oldest insertion first, which is what Map iteration order gives us.
    const oldest = visitors.keys().next().value;
    if (oldest !== undefined) visitors.delete(oldest);
  }
  visitors.set(key, (visitors.get(key) ?? 0) + 1);
}
