export type SortKey = "relevance" | "date";
export type LengthKey = "any" | "short" | "medium" | "long";
export type LevelKey = "any" | "beginner" | "intermediate" | "advanced";

export type Level = Exclude<LevelKey, "any">;

export interface Video {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  publishedAt: string;
  /** Total runtime in seconds. 0 when the API did not return a duration. */
  seconds: number;
  thumbnail: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
  /** Inferred from title and description text, not a field the API provides. */
  level: Level;
  /** The words that produced the level guess, shown on request in the UI. */
  levelSignals: string[];
}

export interface Query {
  q: string;
  sort: SortKey;
  length: LengthKey;
  level: LevelKey;
}

export type SearchFailure =
  /** Our own daily cap, refused before any request is sent. */
  | { kind: "limit"; message: string }
  | { kind: "quota"; message: string }
  | { kind: "key"; message: string }
  | { kind: "network"; message: string }
  | { kind: "unknown"; message: string };

export type SearchResult =
  | { ok: true; videos: Video[]; demo: boolean; cached: boolean }
  | { ok: false; error: SearchFailure };
