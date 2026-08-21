import { Suspense } from "react";
import Filters from "@/components/Filters";
import RecentTopics from "@/components/RecentTopics";
import SearchBar from "@/components/SearchBar";
import {
  EmptyState,
  ErrorState,
  Notice,
  SkeletonGrid,
  StartState,
  SuggestedTopics,
} from "@/components/States";
import VideoGrid from "@/components/VideoGrid";
import { budgetStatus } from "@/lib/budget";
import { searchVideos } from "@/lib/youtube";
import type { LengthKey, LevelKey, Query, SortKey } from "@/lib/types";

type Params = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/** Anything unrecognised falls back to the default rather than throwing. */
function readQuery(sp: Params): Query {
  const sort = one(sp.sort);
  const length = one(sp.length);
  const level = one(sp.level);
  return {
    q: one(sp.q).trim().slice(0, 120),
    sort: (sort === "date" ? "date" : "relevance") as SortKey,
    length: (["short", "medium", "long"].includes(length) ? length : "any") as LengthKey,
    level: (["beginner", "intermediate", "advanced"].includes(level) ? level : "any") as LevelKey,
  };
}

function toHref(q: Query): string {
  const p = new URLSearchParams({ q: q.q });
  if (q.sort !== "relevance") p.set("sort", q.sort);
  if (q.length !== "any") p.set("length", q.length);
  if (q.level !== "any") p.set("level", q.level);
  return `/?${p.toString()}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const query = readQuery(sp);
  const hasTopic = query.q.length > 0;

  return (
    <main id="main">
      {/* The landing view is a centred hero. Once there is a topic the same
          block collapses to a compact left aligned header, so results start
          near the top of the page instead of below a marketing panel. */}
      <div className={hasTopic ? "shell head" : "shell head head-hero"}>
        <div className="intro">
          {hasTopic ? null : (
            <span className="eyebrow">
              <span className="eyebrow-dot" aria-hidden="true" />
              Search first, no feed
            </span>
          )}
          <h1>What do you want to learn?</h1>
          <p>
            One topic in, only videos on that topic out. No feed, no
            recommendations, no comments, nothing queued up next.
          </p>
        </div>

        <SearchBar
          initialQuery={query.q}
          keep={{ sort: query.sort, length: query.length, level: query.level }}
          autoFocus={!hasTopic}
        />
        {hasTopic ? null : <SuggestedTopics />}
        <RecentTopics current={hasTopic ? query.q : undefined} />
      </div>

      {/* Results sit outside the hero so the centring above never applies to
          them. */}
      <div className="shell">
        {hasTopic ? (
          <Suspense
            key={`${query.q}|${query.sort}|${query.length}`}
            fallback={
              <>
                <Filters query={query} count={null} />
                <SkeletonGrid />
              </>
            }
          >
            <Results query={query} />
          </Suspense>
        ) : (
          <StartState />
        )}
      </div>
    </main>
  );
}

/** How few searches must remain before the page says so unprompted. */
const LOW_BUDGET = 10;

async function Results({ query }: { query: Query }) {
  const result = await searchVideos(query);
  // Read after the search, so the count already includes the one just run.
  const budget = budgetStatus();

  if (!result.ok) {
    return (
      <>
        <Filters query={query} count={null} />
        <ErrorState error={result.error} query={query} />
      </>
    );
  }

  // Level is a local heuristic, so it filters the fetched page rather than
  // costing another API call.
  const videos =
    query.level === "any"
      ? result.videos
      : result.videos.filter((v) => v.level === query.level);

  return (
    <>
      <Filters query={query} count={videos.length} />

      {result.demo ? (
        <Notice>
          Demo data. No <code>YOUTUBE_API_KEY</code> is set, so these are local
          fixtures with invented titles rather than search results.
        </Notice>
      ) : null}

      {!result.demo && budget.remaining > 0 && budget.remaining <= LOW_BUDGET ? (
        <Notice tone="danger">
          {budget.remaining} of {budget.limit} searches left today.
        </Notice>
      ) : null}

      {videos.length ? (
        <VideoGrid videos={videos} backTo={toHref(query)} />
      ) : (
        <EmptyState query={query} />
      )}
    </>
  );
}
