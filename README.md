# Ontopic

Enter a topic, get videos on that topic. No feed, no recommendations, no
comments, nothing queued up next.

Next.js 15 App Router, React 19, TypeScript.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Works with no API key. Without one it serves local demo fixtures and labels
them as demo data.

## Adding an API key

1. Create a project in the [Google Cloud console](https://console.cloud.google.com/apis/credentials)
2. Enable **YouTube Data API v3**
3. Create an API key
4. Put it in `.env.local`:

```bash
YOUTUBE_API_KEY=your-key-here
```

Do not add an HTTP referrer restriction. Ontopic calls the API from the server,
so a referrer-restricted key is rejected.

## Environment variables

| Variable | Effect |
|---|---|
| `YOUTUBE_API_KEY` | Real search. Omit for demo fixtures. |
| `YOUTUBE_RELEVANCE_LANGUAGE` | Optional. Biases results toward one language, e.g. `en`. |
| `SEARCH_DAILY_LIMIT` | Optional. Daily search cap, default `60`. |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Lint |
| `npm run typecheck` | Type check |

## Deploying

Needs a server, because the API key must never reach the browser. A static
export will not work.

- **Vercel:** import the repo, add `YOUTUBE_API_KEY`
- **Anything else:** `npm run build && npm start` with `YOUTUBE_API_KEY` set

## Notes

- **Searches are links.** The topic and all filters live in the URL, so any
  search can be bookmarked or shared.
- **Search runs on the server.** The API key never reaches the browser.
- **Capped at 60 searches a day**, resetting at midnight Pacific. Repeating a
  search is served from cache for 10 minutes and does not count.
- **Level is inferred** from keywords in the title, not an API field, so it is
  a guess and labelled as one.
- **24 results per search**, no pagination.
- **Search history stays in the browser** via `localStorage` and is never sent
  anywhere.

The player is YouTube's official embed, so YouTube's own ads and end-screen
suggestions remain. Ontopic is not affiliated with YouTube or Google.
