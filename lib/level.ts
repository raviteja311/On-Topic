import type { Level } from "./types";

/**
 * The YouTube Data API has no difficulty field, so level is inferred from the
 * words a creator chose in the title and description. This is a guess, and the
 * UI says so. The function returns the phrases it matched, so a user can see
 * why a video was placed where it was instead of trusting an opaque label.
 *
 * Title matches are weighted higher than description matches, because a
 * description often lists a whole course ("part of my beginner to advanced
 * series") and would otherwise match everything.
 */

const BEGINNER = [
  "for beginners",
  "beginner",
  "beginners",
  "introduction",
  "intro to",
  "getting started",
  "get started",
  "basics",
  "fundamentals",
  "from zero",
  "step by step",
  "crash course",
  "first steps",
  "101",
  "explained simply",
  "for dummies",
  "no experience",
];

const ADVANCED = [
  "advanced",
  "deep dive",
  "under the hood",
  "internals",
  "in depth",
  "masterclass",
  "expert",
  "optimization",
  "optimisation",
  "performance tuning",
  "production ready",
  "at scale",
  "architecture",
  "research paper",
  "from scratch",
  "low level",
];

const INTERMEDIATE = [
  "intermediate",
  "next steps",
  "beyond the basics",
  "practical",
  "real world",
  "build a",
  "project",
  "hands on",
];

function hits(haystack: string, needles: string[]): string[] {
  return needles.filter((n) => haystack.includes(n));
}

export function inferLevel(
  title: string,
  description: string,
): { level: Level; signals: string[] } {
  const t = ` ${title.toLowerCase()} `;
  const d = ` ${description.toLowerCase().slice(0, 400)} `;

  const scores: Record<Level, number> = {
    beginner: 0,
    intermediate: 0,
    advanced: 0,
  };
  const signals: string[] = [];

  const record = (level: Level, matched: string[], weight: number) => {
    if (!matched.length) return;
    scores[level] += matched.length * weight;
    for (const m of matched) if (!signals.includes(m)) signals.push(m);
  };

  record("beginner", hits(t, BEGINNER), 3);
  record("advanced", hits(t, ADVANCED), 3);
  record("intermediate", hits(t, INTERMEDIATE), 3);
  record("beginner", hits(d, BEGINNER), 1);
  record("advanced", hits(d, ADVANCED), 1);
  record("intermediate", hits(d, INTERMEDIATE), 1);

  const levels = Object.keys(scores) as Level[];
  const top = Math.max(...levels.map((level) => scores[level]));

  // Nothing matched. Intermediate is the honest default: it claims the least
  // about a video whose creator gave us no signal either way.
  if (top === 0) return { level: "intermediate", signals: [] };

  // Two levels scored the same, so the words we found disagree with each other.
  // Falling back for the same reason, rather than letting the order of the keys
  // above pick a winner. The signals still go out, because they are what we
  // actually found, and a reader can see the disagreement for themselves.
  const winners = levels.filter((level) => scores[level] === top);
  if (winners.length > 1) {
    return { level: "intermediate", signals: signals.slice(0, 4) };
  }

  return { level: winners[0], signals: signals.slice(0, 4) };
}

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};
