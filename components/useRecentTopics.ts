"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "ontopic:recent";
const LIMIT = 8;

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === "string").slice(0, LIMIT);
  } catch {
    return [];
  }
}

/**
 * Search history lives in this browser only. It is never sent anywhere, and
 * "Clear" removes it rather than hiding it.
 */
export function useRecentTopics(current?: string) {
  const [topics, setTopics] = useState<string[]>([]);

  // Read after mount so the server and client render the same first pass.
  useEffect(() => {
    setTopics(read());
  }, []);

  useEffect(() => {
    const topic = current?.trim();
    if (!topic) return;
    setTopics((prev) => {
      const next = [topic, ...prev.filter((t) => t.toLowerCase() !== topic.toLowerCase())].slice(0, LIMIT);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable. History is a convenience, so this is not an error.
      }
      return next;
    });
  }, [current]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nothing to do.
    }
    setTopics([]);
  }, []);

  return { topics, clear };
}
