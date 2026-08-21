import type { Video } from "./types";
import { inferLevel } from "./level";

/**
 * Used only when YOUTUBE_API_KEY is unset, so the app is reviewable without a
 * key. These are placeholders with invented titles and channel names, and the
 * UI labels them as demo data rather than passing them off as search results.
 * Thumbnails are drawn locally as SVG so there is no network call and no risk
 * of showing a real creator's artwork against an invented title.
 */

function placeholder(label: string, tone: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
  <rect width="320" height="180" fill="${tone}"/>
  <text x="16" y="164" font-family="monospace" font-size="11" fill="rgba(255,255,255,.72)">${label}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface Seed {
  id: string;
  title: string;
  channel: string;
  days: number;
  seconds: number;
  tone: string;
}

const SEEDS: Seed[] = [
  { id: "demo-01", title: "Machine learning with Python, a beginner's introduction", channel: "Bench Notes", days: 12, seconds: 2721, tone: "#2A3D4F" },
  { id: "demo-02", title: "Gradient descent explained simply, with one plot", channel: "Slow Math", days: 40, seconds: 946, tone: "#3A3350" },
  { id: "demo-03", title: "Building a text classifier end to end, real world project", channel: "Practical ML", days: 5, seconds: 4183, tone: "#1F4740" },
  { id: "demo-04", title: "Advanced feature engineering, a deep dive", channel: "Bench Notes", days: 96, seconds: 3402, tone: "#4A3A2C" },
  { id: "demo-05", title: "Attention internals, under the hood of a transformer", channel: "Paper Walks", days: 210, seconds: 5310, tone: "#2C2E4F" },
  { id: "demo-06", title: "Pandas basics for data prep, step by step", channel: "Slow Math", days: 2, seconds: 1187, tone: "#3F2F3C" },
  { id: "demo-07", title: "Cross validation, what it does and when it lies", channel: "Practical ML", days: 64, seconds: 1502, tone: "#243F4A" },
  { id: "demo-08", title: "Training at scale, performance tuning for large datasets", channel: "Paper Walks", days: 320, seconds: 6045, tone: "#333A2A" },
  { id: "demo-09", title: "Your first neural network, no experience needed", channel: "Bench Notes", days: 18, seconds: 1834, tone: "#452F35" },
  { id: "demo-10", title: "What overfitting is, in three minutes", channel: "Slow Math", days: 8, seconds: 194, tone: "#2E3A44" },
  { id: "demo-11", title: "Choosing a learning rate, practical rules of thumb", channel: "Practical ML", days: 26, seconds: 703, tone: "#3B3348" },
];

export function mockVideos(): Video[] {
  const now = Date.now();
  return SEEDS.map((s) => {
    const description = `Demo fixture. ${s.title}.`;
    const { level, signals } = inferLevel(s.title, description);
    return {
      id: s.id,
      title: s.title,
      channel: s.channel,
      channelId: `demo-channel-${s.channel.toLowerCase().replace(/\s+/g, "-")}`,
      publishedAt: new Date(now - s.days * 86400000).toISOString(),
      seconds: s.seconds,
      thumbnail: placeholder("demo thumbnail", s.tone),
      thumbnailWidth: 320,
      thumbnailHeight: 180,
      level,
      levelSignals: signals,
    };
  });
}
