"use client";

import { useSyncExternalStore } from "react";

type Mode = "light" | "dark";

/**
 * Theme is applied by a blocking script in the document head before first
 * paint, so the data-theme attribute is already correct by the time this runs.
 * That attribute is the source of truth and this component subscribes to it,
 * rather than keeping a second copy in React state that has to be corrected
 * after mount. Without the head script you get a flash of the wrong theme.
 */

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Mode {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** The server cannot know the preference, and the head script has not run yet. */
function getServerSnapshot(): Mode {
  return "light";
}

export default function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    // The observer above turns this into a re-render.
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("ontopic:theme", next);
    } catch {
      // Private browsing can refuse storage. The toggle still works for the session.
    }
  }

  return (
    <button
      type="button"
      className="icon-button"
      onClick={toggle}
      aria-pressed={mode === "dark"}
      aria-label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={mode === "dark" ? "Light theme" : "Dark theme"}
    >
      {mode === "dark" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5l1.5 1.5M17 17l1.5 1.5M18.5 5.5L17 7M7 17l-1.5 1.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M20 14.4A8.4 8.4 0 1 1 9.6 4a6.6 6.6 0 0 0 10.4 10.4z" />
        </svg>
      )}
    </button>
  );
}
