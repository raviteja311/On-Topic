"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main">
      <div className="shell state">
        <h2>Something broke on this page</h2>
        <p>
          This is a fault in Ontopic rather than in your search. Trying again is
          usually enough.
        </p>
        <div className="state-actions">
          <button className="button" type="button" onClick={reset}>
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
