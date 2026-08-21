import type { Metadata, Viewport } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ontopic, focused video search",
    template: "%s · Ontopic",
  },
  description:
    "Enter a topic and get only videos on that topic. No feed, no recommendations, no comments.",
  applicationName: "Ontopic",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1114" },
  ],
};

/**
 * Runs before first paint, so the correct theme is on the element before any
 * pixels are drawn. Any later and the user sees a flash of the wrong theme.
 */
const THEME_SCRIPT = `
(function(){
  try {
    var saved = localStorage.getItem('ontopic:theme');
    var system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = saved === 'light' || saved === 'dark' ? saved : system;
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="header">
          <div className="shell header-in">
            <Link className="wordmark" href="/">
              <span className="wordmark-dot" aria-hidden="true" />
              Ontopic
            </Link>
            <div className="header-spacer" />
            <ThemeToggle />
          </div>
        </header>
        {children}
        <footer className="footer">
          <div className="shell">
            <p>
              Ontopic searches YouTube through its official Data API and plays
              videos in its official embed. It is not affiliated with YouTube or
              Google.
            </p>
            <p>Search history is stored in this browser only and never leaves it.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
