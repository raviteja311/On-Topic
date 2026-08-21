import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main">
      <div className="shell state">
        <h2>That video is not available</h2>
        <p>
          The link may be wrong, or the video may have been removed or made
          private since the search that found it.
        </p>
        <div className="state-actions">
          <Link className="button" href="/">
            Search for a topic
          </Link>
        </div>
      </div>
    </main>
  );
}
