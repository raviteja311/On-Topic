"use client";

import { useRouter } from "next/navigation";
import type { Query } from "@/lib/types";

interface Props {
  query: Query;
  /** Result count after filtering, announced politely for screen readers. */
  count: number | null;
}

const SORTS = [
  { key: "relevance", label: "Relevance" },
  { key: "date", label: "Latest" },
] as const;

const LENGTHS = [
  { key: "any", label: "Any" },
  { key: "short", label: "Under 4 min" },
  { key: "medium", label: "4 to 20 min" },
  { key: "long", label: "Over 20 min" },
] as const;

const LEVELS = [
  { key: "any", label: "Any" },
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
] as const;

export default function Filters({ query, count }: Props) {
  const router = useRouter();

  function set(name: keyof Query, value: string) {
    const params = new URLSearchParams({
      q: query.q,
      sort: query.sort,
      length: query.length,
      level: query.level,
      [name]: value,
    });
    // Defaults do not need to be in the URL.
    for (const [k, v] of [...params.entries()]) {
      if ((k === "sort" && v === "relevance") || (k !== "q" && k !== "sort" && v === "any")) {
        params.delete(k);
      }
    }
    router.push(`/?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="filters">
      <Group
        label="Sort"
        options={SORTS}
        active={query.sort}
        onPick={(v) => set("sort", v)}
      />
      <Group
        label="Duration"
        options={LENGTHS}
        active={query.length}
        onPick={(v) => set("length", v)}
      />
      <Group
        label="Level"
        options={LEVELS}
        active={query.level}
        onPick={(v) => set("level", v)}
        hint="Inferred from the words in each title and description, not a field YouTube provides."
      />
      <p className="filters-meta" role="status" aria-live="polite">
        {count === null ? "" : `${count} ${count === 1 ? "video" : "videos"}`}
      </p>
    </div>
  );
}

interface GroupProps {
  label: string;
  options: ReadonlyArray<{ key: string; label: string }>;
  active: string;
  onPick: (value: string) => void;
  hint?: string;
}

function Group({ label, options, active, onPick, hint }: GroupProps) {
  const id = `filter-${label.toLowerCase()}`;
  return (
    <div className="filter">
      <span className="filter-label" id={id} title={hint}>
        {label}
        {hint ? " (inferred)" : ""}
      </span>
      <div className="segmented" role="group" aria-labelledby={id}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={active === o.key}
            // "Any" appears in two groups, so the generic label needs the
            // dimension to be unambiguous when read on its own.
            aria-label={o.key === "any" ? `Any ${label.toLowerCase()}` : undefined}
            onClick={() => onPick(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
