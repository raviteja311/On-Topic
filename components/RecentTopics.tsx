"use client";

import { useRouter } from "next/navigation";
import { useRecentTopics } from "./useRecentTopics";

/**
 * Renders nothing until there is history, so a first time visitor sees a
 * clean page rather than an empty container.
 */
export default function RecentTopics({ current }: { current?: string }) {
  const { topics, clear } = useRecentTopics(current);
  const router = useRouter();

  const others = topics.filter((t) => t.toLowerCase() !== current?.trim().toLowerCase());
  if (!others.length) return null;

  return (
    <nav className="recent" aria-label="Recent topics">
      <span className="recent-label">Recent</span>
      {others.map((topic) => (
        <button
          key={topic}
          type="button"
          className="chip"
          onClick={() => router.push(`/?q=${encodeURIComponent(topic)}`)}
        >
          {topic}
        </button>
      ))}
      <button type="button" className="chip chip-clear" onClick={clear}>
        Clear
      </button>
    </nav>
  );
}
