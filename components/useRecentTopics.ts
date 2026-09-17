"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const KEY = "ontopic:recent";
const LIMIT = 8;

/**
 * Search history lives in this browser only. It is never sent anywhere, and
 * "Clear" removes it rather than hiding it.
 *
 * localStorage is the single source of truth rather than something copied into
 * React state on mount, so there is no second copy to keep in step and no write
 * hidden inside a state updater, which React is free to call twice.
 *
 * The parsed array is cached against the raw string it came from, because
 * getSnapshot has to return the same reference until the value actually
 * changes or useSyncExternalStore will re-render forever.
 */

const EMPTY: string[] = [];

let cachedRaw: string | null = null;
let cached: string[] = EMPTY;

function parse(raw: string | null): string[] {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return EMPTY;
    return value
      .filter((t): t is string => typeof t === "string")
      .slice(0, LIMIT);
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): string[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Private browsing can refuse storage. History is a convenience, not an error.
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

/** The server has no history, so the first client render has to agree. */
function getServerSnapshot(): string[] {
  return EMPTY;
}

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // "storage" only fires for other tabs, so our own writes go through notify().
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(topics: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(topics));
  } catch {
    // Storage unavailable. History is a convenience, so this is not an error.
  }
  notify();
}

export function useRecentTopics(current?: string) {
  const topics = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Recording the visited topic is an update to an external system, which is
  // what an effect is for. The store notifies its own subscribers afterwards.
  useEffect(() => {
    const topic = current?.trim();
    if (!topic) return;

    const existing = getSnapshot();
    if (existing[0]?.toLowerCase() === topic.toLowerCase()) return;

    const rest = existing.filter((t) => t.toLowerCase() !== topic.toLowerCase());
    write([topic, ...rest].slice(0, LIMIT));
  }, [current]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nothing to do.
    }
    notify();
  }, []);

  return { topics, clear };
}
