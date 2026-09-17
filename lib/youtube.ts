import { cache } from "react";

import { budgetStatus, recordSearch } from "./budget";
import { cacheGet, cacheSet } from "./cache";
import { parseIsoDuration } from "./duration";
import { inferLevel } from "./level";
import { mockVideos } from "./mock";
import type {
  LengthKey,
  Query,
  SearchFailure,
  SearchResult,
  SortKey,
  Video,
} from "./types";

/**
 * This module only ever runs on the server. The API key stays in the process
 * environment and is never sent to the browser, which is why search happens in
 * a server component rather than a fetch from the client.
 */

const BASE = "https://www.googleapis.com/youtube/v3";
const PAGE_SIZE = 24;

interface SearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    channelId?: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url: string; width: number; height: number }>;
  };
}

interface DetailItem {
  id?: string;
  contentDetails?: { duration?: string };
}

function fail(kind: SearchFailure["kind"], message: string): SearchResult {
  return { ok: false, error: { kind, message } };
}

/** Google returns 403 for both a spent quota and a bad key. The reason string separates them. */
function classify(status: number, body: unknown): SearchFailure {
  const reason =
    (body as { error?: { errors?: Array<{ reason?: string }> } })?.error
      ?.errors?.[0]?.reason ?? "";

  if (status === 403 && reason.includes("quota")) {
    return {
      kind: "quota",
      message:
        "The daily API quota for this key is used up. It resets at midnight Pacific time.",
    };
  }
  if (status === 403 || status === 400) {
    return {
      kind: "key",
      message:
        "The YouTube API rejected the key. Check that the key is valid and that YouTube Data API v3 is enabled for the project.",
    };
  }
  return {
    kind: "unknown",
    message: `The YouTube API returned an unexpected status (${status}).`,
  };
}

async function call<T>(
  path: string,
  params: Record<string, string>,
  key: string,
): Promise<{ ok: true; data: T } | { ok: false; error: SearchFailure }> {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);

  let res: Response;
  try {
    res = await fetch(url, {
      // Caching is handled in-process so the TTL is visible in our own code.
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      error: {
        kind: "network",
        message: timedOut
          ? "The YouTube API did not respond in time."
          : "Could not reach the YouTube API.",
      },
    };
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // A non-JSON error body is not worth failing on; status is enough.
    }
    return { ok: false, error: classify(res.status, body) };
  }

  return { ok: true, data: (await res.json()) as T };
}

const DURATION_PARAM: Record<LengthKey, string | null> = {
  any: null,
  short: "short", // under 4 minutes
  medium: "medium", // 4 to 20 minutes
  long: "long", // over 20 minutes
};

const ORDER_PARAM: Record<SortKey, string> = {
  relevance: "relevance",
  date: "date",
};

function pickThumb(
  thumbs: NonNullable<SearchItem["snippet"]>["thumbnails"],
): { url: string; width: number; height: number } {
  const preferred = thumbs?.medium ?? thumbs?.high ?? thumbs?.default;
  return preferred ?? { url: "", width: 320, height: 180 };
}

export function isDemoMode(): boolean {
  return !process.env.YOUTUBE_API_KEY;
}

export async function searchVideos(query: Query): Promise<SearchResult> {
  const key = process.env.YOUTUBE_API_KEY;

  if (!key) {
    // Duration and sort are normally API parameters. In demo mode they are
    // applied here instead, so the filters visibly work without a key.
    return {
      ok: true,
      videos: applyLocally(mockVideos(), query),
      demo: true,
      cached: false,
    };
  }

  // Level is applied after the fact, so it is not part of the cache key: one
  // API round trip serves all four level filters for the same topic.
  const cacheKey = `${query.q.toLowerCase()}|${query.sort}|${query.length}`;
  const cached = cacheGet<Video[]>(cacheKey);
  if (cached) {
    return { ok: true, videos: cached, demo: false, cached: true };
  }

  // Checked after the cache, so a repeat search stays free and never counts
  // against the cap. Checked before the request, so an exhausted budget costs
  // no quota at all: this returns without touching the network.
  const budget = budgetStatus();
  if (budget.exhausted) {
    return fail(
      "limit",
      `Daily limit of ${budget.limit} searches reached. Try again tomorrow.`,
    );
  }

  const searchParams: Record<string, string> = {
    part: "snippet",
    type: "video",
    // Anything not embeddable would open to a dead player, so exclude it here.
    videoEmbeddable: "true",
    safeSearch: "moderate",
    maxResults: String(PAGE_SIZE),
    order: ORDER_PARAM[query.sort],
    q: query.q,
  };

  const durationParam = DURATION_PARAM[query.length];
  if (durationParam) searchParams.videoDuration = durationParam;

  const lang = process.env.YOUTUBE_RELEVANCE_LANGUAGE;
  if (lang) searchParams.relevanceLanguage = lang;

  recordSearch();
  const search = await call<{ items?: SearchItem[] }>(
    "search",
    searchParams,
    key,
  );
  if (!search.ok) return { ok: false, error: search.error };

  const items = (search.data.items ?? []).filter(
    (i): i is SearchItem & { id: { videoId: string } } =>
      typeof i.id?.videoId === "string",
  );
  if (!items.length) {
    return { ok: true, videos: [], demo: false, cached: false };
  }

  // search.list does not return duration, so a second call fills it in.
  // This costs 1 more unit against the quota, against 100 for the search.
  const details = await call<{ items?: DetailItem[] }>(
    "videos",
    {
      part: "contentDetails",
      id: items.map((i) => i.id.videoId).join(","),
      maxResults: String(PAGE_SIZE),
    },
    key,
  );

  const durations = new Map<string, number>();
  if (details.ok) {
    for (const d of details.data.items ?? []) {
      if (d.id) durations.set(d.id, parseIsoDuration(d.contentDetails?.duration));
    }
  }
  // If the details call failed we still render the results, just without
  // durations. Losing one field beats showing an error page.

  const videos: Video[] = items.map((item) => {
    const sn = item.snippet ?? {};
    const title = decodeEntities(sn.title ?? "Untitled");
    const description = decodeEntities(sn.description ?? "");
    const thumb = pickThumb(sn.thumbnails);
    const { level, signals } = inferLevel(title, description);

    return {
      id: item.id.videoId,
      title,
      channel: decodeEntities(sn.channelTitle ?? "Unknown channel"),
      channelId: sn.channelId ?? "",
      publishedAt: sn.publishedAt ?? "",
      seconds: durations.get(item.id.videoId) ?? 0,
      thumbnail: thumb.url,
      thumbnailWidth: thumb.width,
      thumbnailHeight: thumb.height,
      level,
      levelSignals: signals,
    };
  });

  cacheSet(cacheKey, videos);
  return { ok: true, videos, demo: false, cached: false };
}

const LENGTH_BOUNDS: Record<LengthKey, [number, number]> = {
  any: [0, Infinity],
  short: [1, 240],
  medium: [240, 1200],
  long: [1200, Infinity],
};

function applyLocally(videos: Video[], query: Query): Video[] {
  const [min, max] = LENGTH_BOUNDS[query.length];
  const filtered = videos.filter((v) => v.seconds >= min && v.seconds < max);
  return query.sort === "date"
    ? [...filtered].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    : filtered;
}

export interface VideoMeta {
  id: string;
  title: string;
  channel: string;
  publishedAt: string;
  seconds: number;
}

/**
 * Why this is a result rather than `VideoMeta | null`: a null collapses two
 * very different answers into one. "The API told us this video is gone" is a
 * fact about the video. "We could not reach the API" says nothing about the
 * video at all, and reporting it as a missing video blames the user's link for
 * our own outage.
 */
export type VideoMetaResult =
  | { ok: true; meta: VideoMeta }
  /** The lookup ran and came back empty, so the video really is unavailable. */
  | { ok: false; kind: "missing" }
  /** The lookup itself failed, so whether the video exists is still unknown. */
  | { ok: false; kind: "failed"; error: SearchFailure };

/** Used by the watch page. 1 quota unit, so it is cheap to call per view. */
async function fetchVideoMeta(id: string): Promise<VideoMetaResult> {
  const key = process.env.YOUTUBE_API_KEY;

  if (!key) {
    const demo = mockVideos().find((v) => v.id === id);
    return demo
      ? {
          ok: true,
          meta: {
            id: demo.id,
            title: demo.title,
            channel: demo.channel,
            publishedAt: demo.publishedAt,
            seconds: demo.seconds,
          },
        }
      : { ok: false, kind: "missing" };
  }

  const cached = cacheGet<VideoMeta>(`meta|${id}`);
  if (cached) return { ok: true, meta: cached };

  const res = await call<{
    items?: Array<{
      snippet?: { title?: string; channelTitle?: string; publishedAt?: string };
      contentDetails?: { duration?: string };
    }>;
  }>("videos", { part: "snippet,contentDetails", id }, key);

  // The distinction this whole type exists for: a transport or quota failure
  // is not evidence that the video is gone.
  if (!res.ok) return { ok: false, kind: "failed", error: res.error };

  const item = res.data.items?.[0];
  if (!item) return { ok: false, kind: "missing" };

  const meta: VideoMeta = {
    id,
    title: decodeEntities(item.snippet?.title ?? "Untitled"),
    channel: decodeEntities(item.snippet?.channelTitle ?? "Unknown channel"),
    publishedAt: item.snippet?.publishedAt ?? "",
    seconds: parseIsoDuration(item.contentDetails?.duration),
  };
  cacheSet(`meta|${id}`, meta, 60 * 60 * 1000);
  return { ok: true, meta };
}

/**
 * The page and its generateMetadata both need the same lookup, so React's cache
 * collapses them into one per request. The TTL cache above already covers a
 * hit, but a failing lookup never populates it and would otherwise be retried.
 */
export const getVideoMeta = cache(fetchVideoMeta);

/** The API returns titles with HTML entities already escaped, for example &amp;#39;. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
