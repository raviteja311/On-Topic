import Link from "next/link";
import type { Query, SearchFailure } from "@/lib/types";

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </svg>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "danger";
}) {
  return (
    <div className={tone === "danger" ? "notice notice-danger" : "notice"}>
      <InfoIcon />
      <p>{children}</p>
    </div>
  );
}

/** Shown inside Suspense while the search request is in flight. */
export function SkeletonGrid() {
  return (
    <ul className="grid" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i}>
          <div className="skeleton-thumb" />
          <div className="skeleton-line" style={{ width: "92%" }} />
          <div className="skeleton-line" style={{ width: "58%" }} />
        </li>
      ))}
    </ul>
  );
}

/**
 * A search-first tool with an empty landing page is a dead end, so the page
 * offers somewhere to start. These are plain links, which means they work
 * before hydration and can be opened in a new tab.
 */
const SUGGESTIONS = [
  "Python machine learning",
  "React hooks",
  "Docker basics",
  "Linear algebra",
  "Rust ownership",
];

export function SuggestedTopics() {
  return (
    <nav className="suggest" aria-label="Suggested topics">
      <span className="suggest-label">Try</span>
      {SUGGESTIONS.map((topic) => (
        <Link key={topic} className="chip" href={`/?q=${encodeURIComponent(topic)}`}>
          {topic}
        </Link>
      ))}
    </nav>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h11M19 7h1M4 17h5M13 17h7" />
      <circle cx="17" cy="7" r="2.1" />
      <circle cx="11" cy="17" r="2.1" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M10.5 13.5 13.5 10.5" />
      <path d="M9 11 6.8 13.2a3.1 3.1 0 0 0 4.4 4.4L13 15.6" />
      <path d="M15 13 17.2 10.8a3.1 3.1 0 0 0-4.4-4.4L11 8.4" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: <TargetIcon />,
    title: "Only what you asked for",
    body: "The results are the whole page. No sidebar, no trending, no comments, and nothing queued up to play next.",
  },
  {
    icon: <SlidersIcon />,
    title: "Filter by depth and length",
    body: "Sort by relevance or date, narrow by runtime, and pick a level from beginner to advanced.",
  },
  {
    icon: <LinkIcon />,
    title: "Every search is a link",
    body: "The topic and every filter live in the address bar, so any search is something you can bookmark or send to someone.",
  },
];

export function StartState() {
  return (
    <section className="pitch" aria-label="How Ontopic works">
      <ul className="pitch-grid">
        {FEATURES.map((f) => (
          <li key={f.title} className="pitch-card">
            <span className="pitch-icon">{f.icon}</span>
            <h2>{f.title}</h2>
            <p>{f.body}</p>
          </li>
        ))}
      </ul>
      <p className="pitch-foot">
        Press <kbd className="kbd mono">/</kbd> from anywhere to jump back to the
        topic field.
      </p>
    </section>
  );
}

export function EmptyState({ query }: { query: Query }) {
  const narrowed: string[] = [];
  if (query.length !== "any") narrowed.push("duration");
  if (query.level !== "any") narrowed.push("level");

  return (
    <div className="state">
      <h2>No videos matched</h2>
      <p>
        Nothing came back for <strong>{query.q}</strong>
        {narrowed.length ? ` with the ${narrowed.join(" and ")} filter applied.` : "."}
      </p>
      <ul>
        {narrowed.length ? (
          <li>Set {narrowed.join(" and ")} back to Any, which is the most likely fix</li>
        ) : null}
        <li>Try fewer words, or a broader phrasing of the same topic</li>
        <li>Check the spelling of any library or product name</li>
      </ul>
      {narrowed.length ? (
        <div className="state-actions">
          <Link className="button button-quiet" href={`/?q=${encodeURIComponent(query.q)}`}>
            Clear filters
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function ErrorState({
  error,
  query,
}: {
  error: SearchFailure;
  query: Query;
}) {
  const advice: Record<SearchFailure["kind"], string[]> = {
    // Deliberately empty. The message says the whole thing in one line, and a
    // list of caveats under it would only bury it.
    limit: [],
    quota: [
      "The quota resets at midnight Pacific time",
      "A repeated search is served from cache for ten minutes and costs nothing",
      "Raising the quota is a request in the Google Cloud console",
    ],
    key: [
      "Check YOUTUBE_API_KEY in the environment",
      "Confirm YouTube Data API v3 is enabled for that Cloud project",
      "If the key is restricted by referrer, it will reject server side calls",
    ],
    network: [
      "This is usually temporary, so trying again often works",
      "Check outbound network access if this is a fresh deployment",
    ],
    unknown: ["Trying the search again is the first thing to do"],
  };

  // Retrying a spent budget just reproduces the same refusal, so the button
  // only appears when trying again could actually change the outcome.
  const retryable = error.kind !== "limit" && error.kind !== "quota";

  return (
    <div className="state">
      <h2>{error.kind === "limit" ? "Rate limit reached" : "Search could not run"}</h2>
      <p>{error.message}</p>
      {advice[error.kind].length ? (
        <ul>
          {advice[error.kind].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {retryable ? (
        <div className="state-actions">
          <Link
            className="button"
            href={`/?q=${encodeURIComponent(query.q)}&sort=${query.sort}`}
          >
            Try again
          </Link>
        </div>
      ) : null}
    </div>
  );
}
