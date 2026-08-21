"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark";

/**
 * Theme is applied by a blocking script in the document head before first
 * paint, so this component only has to keep the button label in sync and
 * write the user's choice back. Without that script you get a flash of the
 * wrong theme on every navigation.
 */
export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const attr = document.documentElement.dataset.theme;
    setMode(attr === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("ontopic:theme", next);
    } catch {
      // Private browsing can refuse storage. The toggle still works for the session.
    }
    setMode(next);
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
