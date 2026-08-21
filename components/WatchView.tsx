"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatExactDate, formatPublished, spokenDuration } from "@/lib/duration";
import { formatDuration } from "@/lib/duration";
import type { VideoMeta } from "@/lib/youtube";

interface Props {
  meta: VideoMeta;
  backTo: string;
  demo: boolean;
}

export default function WatchView({ meta, backTo, demo }: Props) {
  const [focus, setFocus] = useState(false);

  // The class goes on <body> because focus mode also hides the site header,
  // which is rendered above this component in the layout.
  useEffect(() => {
    document.body.classList.toggle("focus-on", focus);
    return () => document.body.classList.remove("focus-on");
  }, [focus]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFocus((f) => !f);
      }
      if (e.key === "Escape") setFocus(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="watch">
      <Link className="watch-back" href={backTo}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M14 6l-6 6 6 6" />
        </svg>
        Back to results
      </Link>

      <div className="player">
        {demo ? (
          <div className="player-demo">
            <p><strong>Demo mode</strong></p>
            <p style={{ fontSize: "0.875rem" }}>
              This is a fixture, not a real video, so there is nothing to play.
              Add a YouTube API key to search and watch real results.
            </p>
          </div>
        ) : (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(meta.id)}?rel=0&playsinline=1`}
            title={meta.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>

      <div className="watch-head">
        <h1 className="watch-title">{meta.title}</h1>
        <div className="focus-bar">
          <button
            type="button"
            className="button button-quiet"
            style={{ height: 34, padding: "0 0.75rem", fontSize: "0.8125rem" }}
            onClick={() => setFocus((f) => !f)}
            aria-pressed={focus}
          >
            {focus ? "Exit focus" : "Focus mode"}
            <span className="visually-hidden"> (keyboard shortcut f)</span>
          </button>
        </div>
      </div>

      <div className="watch-meta">
        <span>{meta.channel}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={meta.publishedAt} title={formatExactDate(meta.publishedAt)}>
          {formatPublished(meta.publishedAt)}
        </time>
        <span aria-hidden="true">·</span>
        <span className="mono">{formatDuration(meta.seconds)}</span>
        <span className="visually-hidden">{spokenDuration(meta.seconds)}</span>
      </div>

      <p className="watch-note">
        The player is YouTube&apos;s official embed, so playback, captions and
        quality are theirs. Ontopic adds nothing around it: no comments, no
        recommendations, no next video queued up. What Ontopic cannot do is
        change the player itself, so any ads YouTube serves and the related
        videos on its end screen stay as they are. Removing those would mean
        breaking the embed, which is against YouTube&apos;s terms.
      </p>
    </div>
  );
}
