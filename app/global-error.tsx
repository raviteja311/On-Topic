"use client";

/**
 * Only runs when the root layout itself fails, which is why it has to bring its
 * own html and body: the layout that normally supplies them is the thing that
 * broke. That also means no site header, no footer and no globals.css, so the
 * few styles it needs are inline.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          backgroundColor: "#fcfcfd",
          color: "#16181d",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <main style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 600, margin: "0 0 0.75rem" }}>
            Ontopic failed to load
          </h1>
          <p style={{ margin: "0 0 1.5rem", lineHeight: 1.6, color: "#555c66" }}>
            Something broke before the page could be built. This is a fault in
            Ontopic rather than in your search, and trying again is usually
            enough.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              font: "inherit",
              fontWeight: 500,
              cursor: "pointer",
              padding: "0.625rem 1rem",
              borderRadius: 10,
              border: "1px solid transparent",
              backgroundColor: "#0c6a60",
              color: "#ffffff",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
