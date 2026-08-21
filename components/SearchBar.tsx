"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  initialQuery: string;
  /** Preserved so changing the topic does not silently reset the filters. */
  keep: Record<string, string>;
  autoFocus?: boolean;
}

export default function SearchBar({ initialQuery, keep, autoFocus }: Props) {
  const [value, setValue] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keep the field in step when navigation changes the topic, for example
  // when a recent topic chip is used.
  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  // "/" focuses the field from anywhere, the way a search-first tool should.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const topic = value.trim();
    if (!topic) {
      inputRef.current?.focus();
      return;
    }
    // Defaults stay out of the URL so a shared link is readable.
    const params = new URLSearchParams({ q: topic });
    for (const [k, v] of Object.entries(keep)) {
      if (k === "sort" && v !== "relevance") params.set(k, v);
      if (k !== "sort" && v !== "any") params.set(k, v);
    }
    router.push(`/?${params.toString()}`);
  }

  return (
    <form className="search" onSubmit={submit} role="search">
      <div className="search-row">
        <div className="search-field">
          <label htmlFor="topic" className="visually-hidden">
            Topic to learn
          </label>
          <svg
            className="search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 21 21" />
          </svg>
          <input
            id="topic"
            ref={inputRef}
            className="search-input"
            type="search"
            name="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Python machine learning"
            autoComplete="off"
            enterKeyHint="search"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={autoFocus}
          />
          <span className="search-hint mono" aria-hidden="true">
            /
          </span>
        </div>
        <button className="button" type="submit">
          Search
        </button>
      </div>
    </form>
  );
}
